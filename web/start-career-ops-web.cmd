@echo off
cd /d C:\dev\career-ops\web
"C:\Program Files\nodejs\npm.cmd" run start -- --hostname 127.0.0.1 --port 3000 >> .career-ops-web-server.log 2>&1
