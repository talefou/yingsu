#!/usr/bin/env python3
import json
import asyncio
import aiohttp
import time
from datetime import datetime
from pathlib import Path
from tenacity import retry, stop_after_attempt, wait_fixed

DB_URL = "https://raw.githubusercontent.com/talefou/yingsu/reports/db.json"
RESULT_FILE = Path("result.json")
TIMEOUT = 8          # 每个接口最大等待秒数
TEST_PATH = "/?ac=videolist"   # 建议用轻量接口测试（可自行修改）
MAX_CONCURRENT = 15  # 同时并发测试数量

async def test_speed(session, api_url: str) -> tuple[str, float]:
    """测试单个源的速度，返回 (api原地址, 耗时秒数)"""
    start = time.time()
    try:
        url = api_url.rstrip("/") + TEST_PATH
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=TIMEOUT)) as resp:
            if resp.status in (200, 206):
                await resp.read()  # 稍微读一点内容
                return api_url, time.time() - start
            else:
                return api_url, 999.0
    except Exception:
        return api_url, 999.0


@retry(stop=stop_after_attempt(2), wait=wait_fixed(1.5))
async def fetch_db() -> list[dict]:
    async with aiohttp.ClientSession() as session:
        async with session.get(DB_URL) as resp:
            if resp.status != 200:
                raise Exception("无法获取 db.json")
            text = await resp.text()
            return json.loads(text)


async def main():
    print(f"开始更新排行榜 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        sources = await fetch_db()
    except Exception as e:
        print("获取源列表失败:", e)
        return

    print(f"共发现 {len(sources)} 个源")

    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = []
        for item in sources:
            api = item.get("api", "").strip()
            if not api or not api.startswith(("http://", "https://")):
                continue
            tasks.append(test_speed(session, api))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    # 过滤 + 排序（时间越短越靠前，失败的排最后）
    valid_results = []
    for result in results:
        if isinstance(result, Exception):
            continue
        api, duration = result
        # 尝试找对应原始信息
        source = next((s for s in sources if s.get("api", "").strip() == api), None)
        if not source:
            continue

        valid_results.append({
            "name": source.get("name", "未知名称"),
            "api": api,
            "priority": round(duration, 3) if duration < 900 else 9999,
            "status": "success" if duration < 900 else "failed"
        })

    # 排序：优先成功的 → 再按速度快→慢
    valid_results.sort(key=lambda x: (x["status"] != "success", x["priority"]))

    # 最终排行只保留必要字段，并给优先级重新编号
    ranking = []
    for i, item in enumerate(valid_results, 1):
        if item["priority"] > 9000:
            continue  # 过滤掉彻底失败的（可选）
        ranking.append({
            "name": item["name"],
            "api": item["api"],
            "priority": i   # ← 真正的排名序号 1,2,3...
        })

    # 写入 result.json
    with open(RESULT_FILE, "w", encoding="utf-8") as f:
        json.dump(ranking, f, ensure_ascii=False, indent=2)

    print(f"排行榜已生成，共 {len(ranking)} 条有效记录")


if __name__ == "__main__":
    asyncio.run(main())
