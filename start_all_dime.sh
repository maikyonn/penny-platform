#!/bin/bash
# Start or restart all DIME services (Search API + Viewer).

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "🔐 Elevating privileges with sudo..."
    exec sudo "$0" "$@"
fi

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${ROOT_DIR}/logs"
mkdir -p "${LOG_DIR}"

function kill_port() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids=$(lsof -ti tcp:"${port}" || true)
        if [[ -n "${pids}" ]]; then
            echo "🔁 Port ${port} in use; terminating process(es): ${pids}"
            kill ${pids} || true
            sleep 1
        fi
    elif command -v fuser >/dev/null 2>&1; then
        if fuser "${port}/tcp" >/dev/null 2>&1; then
            echo "🔁 Port ${port} in use; terminating via fuser"
            fuser -k "${port}/tcp" || true
            sleep 1
        fi
    else
        echo "⚠️  Neither lsof nor fuser is available; cannot proactively free port ${port}."
    fi
}

function wait_for_port_free() {
    local port="$1"
    local retries=10
    for ((i=1; i<=retries; i++)); do
        if ! lsof -ti tcp:"${port}" >/dev/null 2>&1; then
            return 0
        fi
        echo "⏳ Waiting for port ${port} to be released (attempt ${i}/${retries})..."
        kill $(lsof -ti tcp:"${port}") >/dev/null 2>&1 || true
        sleep 1
    done
    echo "⚠️  Port ${port} still appears busy; continuing anyway."
}

function start_service() {
    local name="$1"
    local dir="$2"
    local port="$3"
    local cmd="$4"

    local service_dir="${ROOT_DIR}/${dir}"
    if [[ ! -d "${service_dir}" ]]; then
        echo "⚠️  Skipping ${name}: directory ${service_dir} not found."
        return
    fi

    echo "🚀 Starting ${name} (port ${port})..."
    kill_port "${port}"
    wait_for_port_free "${port}"

    (
        cd "${service_dir}"
        nohup bash -lc "${cmd}" > "${LOG_DIR}/${name// /_}.log" 2>&1 &
        local pid=$!
        echo "✅ ${name} launched (PID ${pid}); logs -> ${LOG_DIR}/${name// /_}.log"
    )
}

start_service "Search API" "services/search" "7001" "./start.sh"

function ensure_service_venv() {
    local dir_name="$1"
    local service_dir="${ROOT_DIR}/${dir_name}"
    if [[ ! -d "${service_dir}" ]]; then
        echo "⚠️  Cannot ensure virtualenv: directory ${service_dir} not found."
        return
    fi

    local venv_dir="${service_dir}/venv"
    local venv_python="${venv_dir}/bin/python"

    if [[ ! -x "${venv_python}" ]]; then
        local python_cmd=""
        if command -v python3 >/dev/null 2>&1; then
            python_cmd="$(command -v python3)"
        elif command -v python >/dev/null 2>&1; then
            python_cmd="$(command -v python)"
        else
            echo "⚠️  python3 not found on PATH; cannot create virtualenv for ${dir_name}."
            return
        fi

        echo "🧬 Creating virtualenv for ${dir_name}..."
        (
            cd "${service_dir}"
            "${python_cmd}" -m venv venv
        )
    fi

    if [[ ! -x "${venv_python}" ]]; then
        echo "⚠️  Failed to prepare virtualenv for ${dir_name}."
        return
    fi

    echo "🛠️  Ensuring dependencies for ${dir_name}..."
    (
        cd "${service_dir}"
        if [[ ! -x "${venv_dir}/bin/pip" ]]; then
            "${venv_python}" -m ensurepip --upgrade
        fi
        "${venv_python}" -m pip install --upgrade pip
        if [[ -f "requirements.txt" ]]; then
            "${venv_python}" -m pip install -r requirements.txt
        fi
    )
}

function start_redis() {
    local redis_cmd=""
    if command -v redis-server >/dev/null 2>&1; then
        redis_cmd="$(command -v redis-server)"
    elif command -v redis6-server >/dev/null 2>&1; then
        redis_cmd="$(command -v redis6-server)"
    fi

    if [[ -z "${redis_cmd}" ]]; then
        echo "⚠️  Redis not found on PATH; skipping Redis startup."
        return
    fi

    echo "🧠 Starting Redis server on port 6379..."
    kill_port "6379"
    wait_for_port_free "6379"

    if pgrep -f "${redis_cmd}" >/dev/null 2>&1; then
        echo "🔁 Existing Redis process detected; terminating..."
        pkill -f "${redis_cmd}" || true
        sleep 1
    fi

    local log_file="${LOG_DIR}/redis.log"
    nohup "${redis_cmd}" > "${log_file}" 2>&1 &
    local pid=$!
    echo "✅ Redis launched (PID ${pid}); logs -> ${log_file}"
    sleep 1
}

start_redis

function start_rq_workers() {
    local service_dir="${ROOT_DIR}/services/search"
    if [[ ! -d "${service_dir}" ]]; then
        echo "⚠️  Cannot start RQ workers: directory ${service_dir} not found."
        return
    fi

    local worker_specs=(
        "search:2"
        "pipeline:3"
        "default:1"
    )

    if pgrep -f "app\.workers\.rq_worker" >/dev/null 2>&1; then
        echo "🔁 Existing worker processes detected; terminating..."
        pkill -f "app\.workers\.rq_worker" || true
        sleep 1
    fi

    local idx=1
    for spec in "${worker_specs[@]}"; do
        local queue="${spec%%:*}"
        local count="${spec##*:}"
        echo "👷 Spawning ${count} worker(s) for queue '${queue}'..."
        for _ in $(seq 1 "${count}"); do
            local log_file="${LOG_DIR}/rq-worker-${idx}.log"
            (
                cd "${service_dir}"
                nohup bash -lc "source venv/bin/activate && RQ_WORKER_QUEUES='${queue}' python -m app.workers.rq_worker --log-to-stdout" \
                    > "${log_file}" 2>&1 &
                local pid=$!
                echo "   • Worker ${idx} (${queue}) started (PID ${pid}); logs -> ${log_file}"
            )
            idx=$((idx + 1))
        done
    done
}

start_rq_workers
start_service "LanceDB Viewer" "services/viewer" "7002" "./start.sh"
ensure_service_venv "services/brightdata"
start_service "BrightData Image Service" "services/brightdata" "7100" "./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 7100"

echo "✨ All available DIME services have been (re)started."
