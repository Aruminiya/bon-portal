# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 設定在 build 時就被 Vite 換成字面值寫進產物 —— 一個 image 對應一個環境。
#
# 刻意用 ARG 而不是讓 .env 進 build context（.dockerignore 擋著它）：.env 是
# 本機的開發設定（localhost:9000），讓它進來的話，哪天忘記改就會安靜地把
# dev 的 Authentik 位址燒進正式版的 image —— 而那種錯誤不會有任何錯誤訊息，
# 只會讓使用者登入到錯的地方。用 ARG 就必須每次明寫。
ARG VITE_AUTHENTIK_AUTHORITY
ARG VITE_AUTHENTIK_CLIENT_ID
ARG VITE_AUTHENTIK_REDIRECT_URI
ARG VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI

ENV VITE_AUTHENTIK_AUTHORITY=$VITE_AUTHENTIK_AUTHORITY \
    VITE_AUTHENTIK_CLIENT_ID=$VITE_AUTHENTIK_CLIENT_ID \
    VITE_AUTHENTIK_REDIRECT_URI=$VITE_AUTHENTIK_REDIRECT_URI \
    VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=$VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI

# 少了必要參數就直接讓 build 失敗，不要產出一個「跑得起來但登入必壞」的 image。
RUN for v in VITE_AUTHENTIK_AUTHORITY VITE_AUTHENTIK_CLIENT_ID VITE_AUTHENTIK_REDIRECT_URI; do \
      eval "value=\$$v"; \
      if [ -z "$value" ]; then \
        echo "ERROR: build 參數 $v 未提供。請加上 --build-arg $v=..." >&2; \
        exit 1; \
      fi; \
    done

RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
