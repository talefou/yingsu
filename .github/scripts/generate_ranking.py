#!/usr/bin/env python3
import json
import asyncio
import aiohttp
import time
from datetime import datetime
from pathlib import Path
from tenacity import retry, stop_after_attempt, wait_fixed

# 修改为新的数据源地址
CONFIG_URL = "https://raw.githubusercontent.com/talefou/static/refs/heads/main/tv/config.json"
RESULT_FILE = Path("result.json")
TIMEOUT = 10         # 稍微增加超时时间，有些源响应慢
TEST_PATH = "/api.php/provide/vod"   # 轻量测试路径，可改为 "/" 或 "/?ac=videolist"
MAX_CONCURRENT = 12  # 并发别太高，避免被源站封

async def test_speed(session, api_url: str) -> tuple[str, float]:
    """测试单个源的速度，返回 (api原地址, 耗时秒数)"""
    start = time.time()
    try:
        url = api_url.rstrip("/") + TEST_PATH
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=TIMEOUT)) as resp:
            if resp.status in (200, 204, 206):
                # 只读一点内容，避免下载整个列表
                await resp.content.read(1024)
                return api_url, time.time() - start
            else:
                return api_url, 999.0
    except Exception:
        return api_url, 999.0


@retry(stop=stop_after_attempt(2), wait=wait_fixed(2))
async def fetch_config() -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(CONFIG_URL) as resp:
            if resp.status != 200:
                raise Exception(f"获取 config.json 失败，状态码: {resp.status}")
            text = await resp.text()
            return json.loads(text)


async def main():
    print(f"开始更新排行榜 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        config = await fetch_config()
        api_sites = config.get("api_site", {})
        print(f"共发现 {len(api_sites)} 个源")
    except Exception as e:
        print("获取源列表失败:", str(e))
        return

    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = []
        api_to_name = {}  # api -> name 的映射

        for key, item in api_sites.items():
            api = item.get("api", "").strip()
            name = item.get("name", key.upper() or "未知")  # 有name用name，没有用key
            if not api or not api.startswith(("http://", "https://")):
                continue

            api_to_name[api] = name
            tasks.append(test_speed(session, api))

        if not tasks:
            print("没有有效的API地址")
            return

        results = await asyncio.gather(*tasks, return_exceptions=True)

    # 处理结果
    valid_results = []
    for result in results:
        if isinstance(result, Exception):
            continue
        api, duration = result
        name = api_to_name.get(api, "未知")
        valid_results.append({
            "name": name,
            "api": api,
            "priority": round(duration, 3) if duration < 900 else 9999,
            "status": "success" if duration < 900 else "failed"
        })

    # 排序：先成功的，再按速度快→慢
    valid_results.sort(key=lambda x: (x["status"] != "success", x["priority"]))

    # 生成最终排行
    ranking = []
    for i, item in enumerate(valid_results, 1):
        if item["priority"] >= 999:
            continue  # 过滤完全失败的（可选保留）
        ranking.append({
            "name": item["name"],
            "api": item["api"],
            "priority": i  # 排名序号 1,2,3...
        })

    # 如果全失败，写个提示
    if not ranking:
        ranking = [{"note": "暂无可用源，所有测试均超时或失败"}]

    with open(RESULT_FILE, "w", encoding="utf-8") as f:
        json.dump(ranking, f, ensure_ascii=False, indent=2)

    print(f"排行榜已生成，共 {len(ranking)} 条有效记录")


if __name__ == "__main__":
    asyncio.run(main())
