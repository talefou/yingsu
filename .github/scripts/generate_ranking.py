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
TEST_PATH = "/?ac=videolist"   # 可改成更轻量的测试路径，如 "/" 或 "/api.php/provide/vod"
MAX_CONCURRENT = 15  # 并发数

# 名称映射表（根据常见源添加，格式：api地址 -> 友好名称）
name_map = {
    "https://bfzyapi.com/api.php/provide/vod": "暴风资源",
    "http://caiji.dyttzyapi.com/api.php/provide/vod": "电影天堂",
    "http://tyysw.com/api.php/provide/vod": "影素源",
    "https://mtzy2.com/api.php/provide/vod": "MTZY资源",
    "https://caiji.maotaizy.cc/api.php/provide/vod": "茅台资源",
    "https://yingsu.io/api.php/provide/vod": "Yingsu源",
    "https://api.modujx.com/api.php/provide/vod": "Modu资源",
    # 如果有新源，往这里加一行即可
}

async def test_speed(session, api_url: str) -> tuple[str, float]:
    """测试单个源的速度，返回 (api原地址, 耗时秒数)"""
    start = time.time()
    try:
        url = api_url.rstrip("/") + TEST_PATH
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=TIMEOUT)) as resp:
            if resp.status in (200, 206):
                await resp.read()  # 读一点内容确认
                return api_url, time.time() - start
            else:
                return api_url, 999.0
    except Exception:
        return api_url, 999.0


@retry(stop=stop_after_attempt(2), wait=wait_fixed(1.5))
async def fetch_db() -> list:
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
            if isinstance(item, dict):
                api = item.get("api", "").strip()
                name = item.get("name", "未知名称")
            elif isinstance(item, str):
                api = item.strip()
                # 从映射表取名称，找不到就用域名简写
                name = name_map.get(api, api.split("://")[-1].split("/")[0].split(".")[0].upper() or "未知")
            else:
                continue  # 跳过无效项

            if not api or not api.startswith(("http://", "https://")):
                continue

            tasks.append(test_speed(session, api))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    # 过滤 + 排序
    valid_results = []
    for result in results:
        if isinstance(result, Exception):
            continue
        api, duration = result
        # 找对应名称（从刚才循环中已处理）
        # 这里用 api 反查 name
        source_name = name_map.get(api, api.split("://")[-1].split("/")[0].split(".")[0].upper() or "未知")
        valid_results.append({
            "name": source_name,
            "api": api,
            "priority": round(duration, 3) if duration < 900 else 9999,
            "status": "success" if duration < 900 else "failed"
        })

    # 排序：成功 > 速度快到慢
    valid_results.sort(key=lambda x: (x["status"] != "success", x["priority"]))

    # 生成最终排行（priority 为序号 1,2,3...）
    ranking = []
    for i, item in enumerate(valid_results, 1):
        if item["priority"] > 9000:
            continue  # 过滤彻底失败的
        ranking.append({
            "name": item["name"],
            "api": item["api"],
            "priority": i
        })

    # 写入文件（即使空也写）
    if not ranking:
        ranking = [{"note": "暂无可用源，所有测试均失败"}]
    with open(RESULT_FILE, "w", encoding="utf-8") as f:
        json.dump(ranking, f, ensure_ascii=False, indent=2)

    print(f"排行榜已生成，共 {len(ranking)} 条有效记录")


if __name__ == "__main__":
    asyncio.run(main())
