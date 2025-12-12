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

  export function parse(
    input: File | Blob | ArrayBuffer,
    options?: {
      pick?: string[];
    }
  ): Promise<Record<string, unknown> | undefined | null>;
}
