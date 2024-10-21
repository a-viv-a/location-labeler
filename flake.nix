{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
    brawler-cli = {
      # change the version here to update
      url = "https://github.com/hasundue/brawler/archive/refs/tags/0.2.1.tar.gz";
      flake = false;
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      utils,
      brawler-cli,
    }:
    utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShell =
          with pkgs;
          mkShell {
            buildInputs = [
              deno
              wrangler
              # this is... not pure, but it works
              (writeShellApplication {
                name = "brawler";
                runtimeInputs = [
                  deno
                  esbuild
                ];
                text = ''
                  # this is super evil...
                  LOCK=$(mktemp)
                  cat "${brawler-cli}/deno.lock" > "$LOCK"
                  # shellcheck disable=SC2068
                  exec ${lib.getExe deno} run \
                  --lock="$LOCK" \
                  --allow-read \
                  --allow-write \
                  --allow-run \
                  --allow-env \
                  --allow-net \
                  "${brawler-cli}/cli.ts" $@
                '';
              })
            ];
          };
      }
    );
}
