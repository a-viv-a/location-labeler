dev:
    wrangler dev

deploy:
    wrangler deploy

d1_cmd COMMAND:
    wrangler d1 execute label-status --command '{{COMMAND}}' --json | bat -l json

d1_cmd_table COMMAND:
    wrangler d1 execute label-status --command '{{COMMAND}}'

test:
    npx vitest --exclude ".direnv/**"

typegen:
    wrangler types
