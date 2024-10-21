{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
    denoflare-cli = {
      # change the version here to update
      url = "https://github.com/skymethod/denoflare/archive/refs/tags/v0.6.0.tar.gz";
      flake = false;
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      utils,
      denoflare-cli,
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
              # this is... not pure, but it works
              (writeShellApplication {
                name = "denoflare";
                # no need, we can just reference it
                # runtimeInputs = [ deno ];
                text = ''
                  ${lib.getExe deno} run \
                  --unstable-worker-options \
                  --allow-read \
                  --allow-net \
                  --allow-env \
                  --allow-run \
                  --allow-import \
                  "${denoflare-cli}/cli/cli.ts" "$@"
                '';
              })
            ];
          };
      }
    );
}
