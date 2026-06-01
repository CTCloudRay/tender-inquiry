# ===================================================
# 政府標案查詢系統 — Docker 容器建置檔
# ===================================================
#
# 基於 Node.js 18-slim，安裝 Google Chrome 供 Puppeteer 使用。
# 建置流程：安裝依賴 → 複製原始碼 → 建置前端 → 啟動伺服器
#
# 用法：
#   docker build -t tender-inquiry .
#   docker run -p 3001:3001 tender-inquiry

FROM node:20-slim

# ========== 安裝 Chrome 與中文字體 ==========
# Puppeteer 需要完整的 Chrome 瀏覽器才能正常運作
# 同時安裝各語系字體（中文、日文、阿拉伯文、希伯來文、泰文等）
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
  && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# ========== 設定工作目錄 ==========
WORKDIR /app

# ========== 安裝依賴（利用 Docker 快取層） ==========

# 複製根目錄 package.json
COPY package.json ./

# 建立目錄結構
RUN mkdir -p server client

# 安裝後端依賴
COPY server/package.json ./server/
RUN cd server && npm install

# 安裝前端依賴
COPY client/package.json ./client/
RUN cd client && npm install

# ========== 複製原始碼 ==========
COPY server ./server
COPY client ./client

# ========== 建置前端（Production Build） ==========
RUN cd client && npm run build

# ========== 對外開放 Port ==========
EXPOSE 3001

# ========== 啟動伺服器 ==========
# Express 伺服器會自動 serve 前端靜態檔案
CMD ["node", "server/index.js"]
