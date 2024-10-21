{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      utils,
    }:
    utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        denoflare-cli = "https://raw.githubusercontent.com/skymethod/denoflare/v0.6.0/cli/cli.ts";
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
                runtimeInputs = [ deno ];
                text = ''
                  ${lib.getExe deno} run \
                  --unstable-worker-options \
                  --allow-read \
                  --allow-net \
                  --allow-env \
                  --allow-run \
                  --allow-import \
                  "${denoflare-cli}" "$@"
                '';
              })
            ];
          };
      }
    );
}
