declare module "exifr" {
  // Minimal typing for the subset we use
  export function gps(file: File): Promise<
    | {
        latitude: number;
        longitude: number;
      }
    | undefined
    | null
  >;
}
