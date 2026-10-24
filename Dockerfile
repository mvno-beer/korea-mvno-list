# Playwright 이미지 버전은 package-lock.json의 playwright(browser-use 의존성) 버전과 맞춘다.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

# headful 실행용: 가상 디스플레이(Xvfb는 이미지에 포함)를 VNC → noVNC(웹)로 내보낸다.
RUN apt-get update \
    && apt-get install -y --no-install-recommends x11vnc novnc websockify \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 브라우저는 이미지에 포함되어 있다. browser-use는 IN_DOCKER면 Chromium을 --no-sandbox로 띄운다.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    IN_DOCKER=true \
    BROWSER_USE_HEADLESS=true

COPY package.json package-lock.json ./
RUN npm ci

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY . .

ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "start"]
