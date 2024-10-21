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

            # TODO: avoid copying everything...
            buildCommand = ''
              # Deno wants to create cache directories.
              # By default $HOME points to /homeless-shelter, which isn't writable.
              HOME="$(mktemp -d)"
              mkdir $HOME/pkg-src
              cp -r ${self}/* $HOME/pkg-src/
              cd $HOME/pkg-src

              # Build vendor directory
              deno cache --allow-import index.ts
              cp -r ./vendor $out
            '';

            # Here we specify the hash, which makes this a fixed-output derivation.
            # When inputs have changed, outputHash should be set to empty, to recalculate the new hash.
            outputHashAlgo = "sha256";
            outputHashMode = "recursive";
            outputHash = "sha256-xXnbh1ekKZijMHG1kgYG5/akCOpYFLqI9/8gKYimbJw=";
          };
        devShell =
          with pkgs;
          mkShell {
            buildInputs = [
              deno
              wrangler
            ];

            shellHook = ''
              export DENO_VENDOR="${self.packages.${system}.deno-vendor}"
              ln -s $DENO_VENDOR ./vendor
            '';
          };
      }
    );
}
