dev:
    wrangler dev

deploy:
    wrangler deploy

check:
    tsc --noEmit --watch

d1_cmd COMMAND *FLAGS:
    wrangler d1 execute label-status --command '{{COMMAND}}' --json {{FLAGS}} | bat -l json

d1_cmd_table COMMAND *FLAGS:
    wrangler d1 execute label-status --command '{{COMMAND}}' {{FLAGS}}

test:
    npx vitest --exclude ".direnv/**"

typegen:
    wrangler types

tail:
    wrangler tail
