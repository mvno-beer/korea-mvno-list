#!/bin/sh
# BROWSER_USE_HEADLESS=false면 가상 디스플레이(Xvfb)를 띄우고 noVNC로 화면을 내보낸다.
set -e

# browser-use는 빈 문자열을 false(headful)로 읽는다. 이 프로젝트는 빈 값을 미설정으로 보므로,
# 컨테이너에서는 미설정·빈 값을 headless로 고정한다.
case "$(printf '%s' "${BROWSER_USE_HEADLESS:-true}" | tr '[:upper:]' '[:lower:]')" in
  0 | false | no | off) headless=false ;;
  *) headless=true ;;
esac
export BROWSER_USE_HEADLESS="$headless"

if [ "$headless" = false ]; then
  export DISPLAY=:99
  Xvfb :99 -screen 0 "${SCREEN_SIZE:-1920x1080x24}" -nolisten tcp >/dev/null 2>&1 &
  i=0
  while [ ! -e /tmp/.X11-unix/X99 ]; do
    i=$((i + 1))
    [ "$i" -gt 50 ] && { echo 'Xvfb 시작 실패' >&2; exit 1; }
    sleep 0.1
  done
  x11vnc -display :99 -rfbport 5900 -localhost -forever -shared -nopw -quiet >/dev/null 2>&1 &
  websockify --web /usr/share/novnc 6080 localhost:5900 >/dev/null 2>&1 &
  echo "브라우저 화면: http://localhost:6080/vnc.html?autoconnect=1&resize=scale"
fi

exec "$@"
