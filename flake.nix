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
        packages.location-labeler-vendor =
          with pkgs;
          stdenv.mkDerivation {
            name = "location-labeler-vendor";

            nativeBuildInputs = [
              deno
              # breakpointHook
            ];
            src = ./.;

            buildCommand = ''
              # Deno wants to create cache directories.
              # By default $HOME points to /homeless-shelter, which isn't writable.
              HOME="$(mktemp -d)"
              # mkdir $HOME/pkg-src
              # cp -r ${self}/* $HOME/pkg-src/
              # cd $HOME/pkg-src

              # Build vendor directory
              ${lib.getExe deno} cache --allow-import index.ts
              cp -r ./vendor $out
            '';

            # Here we specify the hash, which makes this a fixed-output derivation.
            # When inputs have changed, outputHash should be set to empty, to recalculate the new hash.
            outputHashAlgo = "sha256";
            outputHashMode = "recursive";
            outputHash = "sha256-I/PAdkpYyI8IC9hFWry6DizMRp7usjnKicKSwrchDeY=";
          };
        devShell =
          with pkgs;
          mkShell {
            buildInputs = [
              deno
              wrangler
              self.packages.${system}.location-labeler-vendor
            ];
          };
      }
    );
}
