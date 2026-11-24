export interface ChannelMetadata {
  key: string;
  name: string;
  longName: unknown;
  units: string;
  dimension: number[];
  kind: string;
}

export interface FrameMetadata {
  key: string;
  name: string;
  description: string;
  indexType: string;
  direction: string;
  spacing: number | null;
  channels: ChannelMetadata[];
  channelNames: string[];
}

export interface OriginMetadata {
  wellName?: string;
  fieldName?: string;
  company?: string;
  fileSetName?: string;
  runNumber?: number | string | null;
}

export interface DlisMetadata {
  hash: string;
  version: string;
  warnings: string[];
  logicalFiles: {
    index: number;
    id: string;
    origin: OriginMetadata | null;
    parameters: {
      name: string;
      longName: unknown;
      units: string;
      values: unknown[];
    }[];
    frames: FrameMetadata[];
  }[];
}

export interface DecodedFrame {
  frameCount: number;
  frameNumbers: Int32Array<ArrayBuffer>;
  data: Record<string, Float64Array<ArrayBuffer>>;
  strides: Record<string, number>;
  channels: { name: string; dimension: number[]; units: string }[];
}

export interface FrameValidation {
  lf: number;
  frame: string;
  samples?: number;
  depthRangeMeters?: number[] | null;
  ok: boolean;
  error?: string;
}

export interface CalibrationForm {
  reference: string;
  source: string;
  goodMax: string;
  badMin: string;
}
