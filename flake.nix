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
        devShell =
          with pkgs;
          mkShell {
            buildInputs = [
              nodejs_20
              wrangler
              just
              typescript
              typescript-language-server
            ];

            shellHook = ''
              export LATLON_SF='lat=37.773972?lon=-122.431297'
              export LATLON_MAD='lat=43.073051?lon=-89.401230'
              export LATLON_FITCH_WI='lat=43.002316?lon=-89.424095'
              export LATLON_FITCH_MA='lat=42.586716?lon=-71.814468'
              export LATLON_BATMAN='lat=38.0758?lon=41.4043'
            '';
          };
      }
    );
}
