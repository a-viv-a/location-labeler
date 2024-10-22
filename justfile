dev:
    wrangler dev

deploy:
    wrangler deploy

test:
    npx vitest --exclude ".direnv/**"

typegen:
    wrangler types
