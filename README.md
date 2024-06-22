# banjodraw

Excalidraw wrapper

## Database

```bash
# use local docker instance (change .env)
nr db:local:run

# see logs
nr db:local:logs

# reset database (remove all data)
nr db:reset

# open prisma studio
npx prisma studio
```

## Build specific app

```bash
# build web
turbo run build --filter={./apps/web}...
```

## Clean build

```bash
nr clean && find . -name '.turbo' | xargs rm -rf && ni && nr build --filter api && node apps/api/dist/index.cjs
```

## TODO

-   [ ] Clear local storage on change from slug to non-slug
-   [x] Save images to database
