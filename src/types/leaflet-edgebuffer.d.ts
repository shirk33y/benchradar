import "leaflet";

declare module "leaflet" {
  interface GridLayerOptions {
    edgeBufferTiles?: number;
  }
}
