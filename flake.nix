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
      in
      {
        packages.deno-vendor =
          with pkgs;
          stdenv.mkDerivation {
            name = "deno-vendor";

            nativeBuildInputs = [
              deno
              # breakpointHook
            ];
            src = ./.;

            buildCommand = ''
              # Deno wants to create cache directories.
              # By default $HOME points to /homeless-shelter, which isn't writable.
              HOME="$(mktemp -d)"
              mkdir $HOME/pkg-src
              cp -r ${self}/* $HOME/pkg-src/
              cd $HOME/pkg-src

              # Build vendor directory
              deno cache --vendor --allow-import index.ts
              cp -r $HOME/pkg-src $out
            '';

            # Here we specify the hash, which makes this a fixed-output derivation.
            # When inputs have changed, outputHash should be set to empty, to recalculate the new hash.
            outputHashAlgo = "sha256";
            outputHashMode = "recursive";
            outputHash = "sha256-Q8j+jnAgx6aFnmY/tNgMgCzRn5O1CsYi9tuM8Phe450=";
          };
        devShell =
          with pkgs;
          mkShell {
            buildInputs = [
              deno
              wrangler
              (writeShellApplication {
                name = "import-map";

                text = ''
                  cat ${self.packages.${system}.deno-vendor}/import-map.json
                '';
              })
            ];
          };
      }
    );
}
