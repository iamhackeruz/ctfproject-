#!/usr/bin/env python3
"""
load_test_capacity.py — CTF v2 Realistik Brute-Force & Concurrency Sig'im Testi
Davomiyligi: 180 soniya (3 daqiqa)
Bosqichlar (har biri 30 soniya):
  1. 15 foydalanuvchi  (0-30 soniya)  — Boshlang'ich me'yoriy holat
  2. 40 foydalanuvchi  (30-60 soniya) — O'rta guruh / musobaqa boshlanishi
  3. 80 foydalanuvchi  (60-90 soniya) — Katta auditoriya, intensiv brute-force
  4. 150 foydalanuvchi (90-120 soniya)— Yuqori yuklama, poyga holatlari
  5. 300 foydalanuvchi (120-150 soniya)— Haddan tashqari yuklama (Stress peak)
  6. 500 foydalanuvchi (150-180 soniya)— Maksimal to'yinish / Yiqilish (Breakdown)
"""

import asyncio
import aiohttp
import time
import random
import json
import subprocess
import sys
from datetime import datetime

TARGET_WEB = "http://127.0.0.1:5000"
TARGET_DASHBOARD = "http://127.0.0.1:8080"

STAGES = [
    {"name": "Bosqich 1 (Normal yuklama)",     "duration": 30, "concurrency": 15},
    {"name": "Bosqich 2 (O'rta musobaqa)",      "duration": 30, "concurrency": 40},
    {"name": "Bosqich 3 (Katta guruh / Brute)",  "duration": 30, "concurrency": 80},
    {"name": "Bosqich 4 (Og'ir poyga / Fuzzing)", "duration": 30, "concurrency": 150},
    {"name": "Bosqich 5 (Stress Peak)",          "duration": 30, "concurrency": 300},
    {"name": "Bosqich 6 (Maksimal Saturatsiya)", "duration": 30, "concurrency": 500},
]

# Umumiy statistika
all_stage_results = []
current_stage_idx = 0
stop_event = asyncio.Event()

def get_docker_stats():
    """ctf_v2_web_target va ctf_v2_live_matrix konteynerlarining CPU va RAM holatini olish."""
    try:
        res = subprocess.run(
            ["docker", "stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}"],
            capture_output=True, text=True, timeout=3
        )
        stats = {}
        for line in res.stdout.strip().split("\n"):
            parts = line.split("|")
            if len(parts) == 3:
                name, cpu, mem = parts[0].strip(), parts[1].strip(), parts[2].strip()
                if "ctf_v2" in name:
                    stats[name] = {"cpu": cpu, "mem": mem}
        return stats
    except Exception:
        return {}

async def simulate_worker(worker_id, session, metrics):
    """
    Har bir virtual foydalanuvchi (worker) real CTF harakatlarini bajaradi:
    - 50%: Staff-login ga parol brute-force (X-Forwarded-For bilan)
    - 25%: Login / User enum brute-force
    - 15%: /services/search SQLi / Fuzzing so'rovlari
    - 10%: /api/ctf/submit-flag ga flag tekshirish (DB yozish concurrency)
    """
    passwords = ["123456", "admin", "password", "spring2026", "secret", "apex2026", "toor", "qwerty", "letmein", "welcome"]
    users = ["asmith", "admin", "jdoe", "bwayne", "ckent", "tstark", "developer", "root"]

    while not stop_event.is_set():
        rand_action = random.random()
        t0 = time.time()
        status_code = None
        error_type = None

        try:
            if rand_action < 0.50:
                # 1. Staff login bruteforce (V3 bypass)
                spoofed_ip = f"127.0.{random.randint(1, 250)}.{random.randint(1, 250)}"
                p = random.choice(passwords)
                headers = {"X-Forwarded-For": spoofed_ip}
                data = {"username": "asmith", "password": p}
                async with session.post(f"{TARGET_WEB}/portal/staff-login", data=data, headers=headers, timeout=aiohttp.ClientTimeout(total=5.0)) as resp:
                    status_code = resp.status
                    await resp.read()

            elif rand_action < 0.75:
                # 2. User enum bruteforce
                u = random.choice(users)
                p = random.choice(passwords)
                json_data = {"username": u, "password": p}
                async with session.post(f"{TARGET_WEB}/login", json=json_data, timeout=aiohttp.ClientTimeout(total=5.0)) as resp:
                    status_code = resp.status
                    await resp.read()

            elif rand_action < 0.90:
                # 3. SQLi / Search fuzzing
                payloads = ["' OR 1=1--", "cyber", "apex' UNION SELECT 1,2,3--", "<script>", "security"]
                q = random.choice(payloads)
                async with session.get(f"{TARGET_WEB}/services/search", params={"q": q}, timeout=aiohttp.ClientTimeout(total=5.0)) as resp:
                    status_code = resp.status
                    await resp.read()

            else:
                # 4. Flag submission (SQLite markaziy DB ga yozish)
                dummy_flag = f"FLAG{{v2_fake_flag_{random.randint(100, 999)}}}"
                sub_user = f"stress_bot_{worker_id}"
                async with session.post(f"{TARGET_WEB}/api/ctf/submit-flag", json={"username": sub_user, "flag": dummy_flag}, timeout=aiohttp.ClientTimeout(total=5.0)) as resp:
                    status_code = resp.status
                    await resp.read()

            latency_ms = (time.time() - t0) * 1000.0
            metrics["latencies"].append(latency_ms)
            metrics["status_codes"][status_code] = metrics["status_codes"].get(status_code, 0) + 1
            if status_code == 200 or status_code in (401, 403, 404):
                metrics["success_count"] += 1
            elif status_code == 429:
                metrics["rate_limited_count"] += 1
            elif status_code >= 500:
                metrics["http_5xx_count"] += 1
            else:
                metrics["other_count"] += 1

        except asyncio.TimeoutError:
            metrics["timeout_count"] += 1
            metrics["errors"].append("Timeout (>5.0s)")
        except aiohttp.ClientConnectorError as e:
            metrics["conn_refused_count"] += 1
            metrics["errors"].append(f"ConnRefused: {e}")
        except Exception as e:
            metrics["other_error_count"] += 1
            metrics["errors"].append(f"OtherErr: {type(e).__name__}")

        # Realistik pauza (har bir foydalanuvchi so'rovlar orasida 0.05 - 0.15s kutadi)
        await asyncio.sleep(random.uniform(0.05, 0.15))

async def run_stage(stage_info, stage_num, total_stages):
    name = stage_info["name"]
    duration = stage_info["duration"]
    concurrency = stage_info["concurrency"]

    print("\n" + "="*75)
    print(f"🚀 [{stage_num}/{total_stages}] {name.upper()}")
    print(f"👥 Bir vaqtdagi foydalanuvchilar (Concurrency): {concurrency} ta")
    print(f"⏱️ Davomiyligi: {duration} soniya | Simulyatsiya: Brute-Force, Fuzzing, Flag submit")
    print("="*75)

    metrics = {
        "latencies": [],
        "status_codes": {},
        "success_count": 0,
        "rate_limited_count": 0,
        "http_5xx_count": 0,
        "timeout_count": 0,
        "conn_refused_count": 0,
        "other_error_count": 0,
        "errors": []
    }

    connector = aiohttp.TCPConnector(limit=concurrency + 50, limit_per_host=concurrency + 50, enable_cleanup_closed=True)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Workerlarni ishga tushirish
        tasks = [asyncio.create_task(simulate_worker(i, session, metrics)) for i in range(concurrency)]

        start_time = time.time()
        last_report_time = start_time
        last_req_count = 0

        # Har 5 soniyada progress hisoboti
        while time.time() - start_time < duration:
            await asyncio.sleep(5)
            now = time.time()
            elapsed_interval = now - last_report_time
            current_total = len(metrics["latencies"]) + metrics["timeout_count"] + metrics["conn_refused_count"] + metrics["other_error_count"]
            interval_reqs = current_total - last_req_count
            interval_rps = interval_reqs / elapsed_interval if elapsed_interval > 0 else 0

            # So'nggi kechikishlar
            recent_lats = metrics["latencies"][-interval_reqs:] if interval_reqs > 0 and len(metrics["latencies"]) >= interval_reqs else metrics["latencies"]
            avg_lat = sum(recent_lats) / len(recent_lats) if recent_lats else 0
            max_lat = max(recent_lats) if recent_lats else 0

            # Docker stats
            dstats = get_docker_stats()
            web_cpu = dstats.get("ctf_v2_web_target", {}).get("cpu", "N/A")
            web_mem = dstats.get("ctf_v2_web_target", {}).get("mem", "N/A")

            print(f"  [{int(now - start_time):02d}s/{duration}s] Concurrency: {concurrency:3d} | RPS: {interval_rps:6.1f} | Avg Lat: {avg_lat:6.1f}ms (Max: {max_lat:6.1f}ms) | Web CPU: {web_cpu:>7} | 5xx: {metrics['http_5xx_count']} | Timeout: {metrics['timeout_count']} | ConnErr: {metrics['conn_refused_count']}")

            last_report_time = now
            last_req_count = current_total

        # Bosqich tugadi - workerlarni to'xtatish
        stop_event.set()
        await asyncio.gather(*tasks, return_exceptions=True)
        stop_event.clear()

    # Bosqich yakuni hisobi
    stage_duration = time.time() - start_time
    total_reqs = len(metrics["latencies"]) + metrics["timeout_count"] + metrics["conn_refused_count"] + metrics["other_error_count"]
    total_rps = total_reqs / stage_duration if stage_duration > 0 else 0

    lats = sorted(metrics["latencies"])
    p50 = lats[int(len(lats) * 0.50)] if lats else 0
    p95 = lats[int(len(lats) * 0.95)] if lats else 0
    p99 = lats[int(len(lats) * 0.99)] if lats else 0
    avg_lat = sum(lats) / len(lats) if lats else 0

    stage_summary = {
        "stage": name,
        "concurrency": concurrency,
        "duration_sec": round(stage_duration, 1),
        "total_requests": total_reqs,
        "rps": round(total_rps, 1),
        "lat_avg_ms": round(avg_lat, 1),
        "lat_p50_ms": round(p50, 1),
        "lat_p95_ms": round(p95, 1),
        "lat_p99_ms": round(p99, 1),
        "lat_max_ms": round(max(lats), 1) if lats else 0,
        "status_codes": metrics["status_codes"],
        "http_5xx": metrics["http_5xx_count"],
        "rate_limited_429": metrics["rate_limited_count"],
        "timeouts": metrics["timeout_count"],
        "conn_refused": metrics["conn_refused_count"],
        "other_errors": metrics["other_error_count"]
    }
    all_stage_results.append(stage_summary)

    print(f"  👉 Natija: Jami {total_reqs} ta so'rov ({total_rps:.1f} req/s). Avg: {avg_lat:.1f}ms, P95: {p95:.1f}ms. Xatolar: 5xx={metrics['http_5xx_count']}, Timeout={metrics['timeout_count']}, Refused={metrics['conn_refused_count']}")

async def main():
    print("="*75)
    print("🎯 CTF v2 TO'LIQ SIG'IM VA CONCURRENCY STRESS TESTI (3 DAQIQA)")
    print("Boshlanish vaqti:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print(f"Target Veb Ilova: {TARGET_WEB}")
    print(f"Target Jonli Dashboard: {TARGET_DASHBOARD}")
    print("="*75)

    total_stages = len(STAGES)
    test_start = time.time()

    for idx, stage in enumerate(STAGES, 1):
        await run_stage(stage, idx, total_stages)
        await asyncio.sleep(2)  # Bosqichlar orasida 2 soniya dam olish / portlarni bo'shatish

    total_test_time = time.time() - test_start
    print("\n" + "="*75)
    print("🏁 3 DAQIQALIK TEST TO'LIQ YAKUNLANDI!")
    print(f"Umumiy sarflangan vaqt: {total_test_time:.1f} soniya ({total_test_time/60:.2f} daqiqa)")
    print("="*75)

    # To'liq jadval
    print("\n📊 BOSQICHMA-BOSQICH QIYOSIY TAHLIL JADVALI:")
    header = f"{'Bosqich':<30} | {'Users':<6} | {'RPS':<8} | {'Avg Lat':<9} | {'P95 Lat':<9} | {'5xx':<5} | {'Timeout':<8} | {'Holat':<10}"
    print("-" * len(header))
    print(header)
    print("-" * len(header))

    capacity_limit = "500+"
    bottleneck_found = False

    for r in all_stage_results:
        is_failing = (r["http_5xx"] > 0 or r["timeouts"] > 0 or r["conn_refused"] > 0 or r["lat_avg_ms"] > 2000)
        is_degraded = (r["lat_avg_ms"] > 800 or r["lat_p95_ms"] > 1500)
        
        if is_failing:
            status = "❌ YIQILDI"
            if not bottleneck_found:
                capacity_limit = f"~{r['concurrency']} foydalanuvchi (Yiqilish nuqtasi)"
                bottleneck_found = True
        elif is_degraded:
            status = "⚠️ SEKINLASHDI"
            if not bottleneck_found:
                capacity_limit = f"~{r['concurrency']} foydalanuvchi (Degradatsiya boshlanishi)"
        else:
            status = "✅ BARDOSH"

        print(f"{r['stage']:<30} | {r['concurrency']:<6} | {r['rps']:<8} | {r['lat_avg_ms']:<7.1f}ms | {r['lat_p95_ms']:<7.1f}ms | {r['http_5xx']:<5} | {r['timeouts']:<8} | {status:<10}")

    print("-" * len(header))

    # JSON faylga saqlash
    output_file = "/home/user/ctf-v2/load_test_results.json"
    with open(output_file, "w") as f:
        json.dump({
            "test_date": datetime.now().isoformat(),
            "total_duration_sec": total_test_time,
            "stages": all_stage_results,
            "estimated_capacity": capacity_limit
        }, f, indent=2)
    print(f"\n💾 To'liq test hisoboti faylga saqlandi: {output_file}")

if __name__ == "__main__":
    asyncio.run(main())
