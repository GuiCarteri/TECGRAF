import type { CatalogFile } from "./catalog";
import type { CalibrationForm, DlisMetadata } from "./dlis/types";
import type { LogPoint } from "./dlis/points";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "user" | "publisher" | "admin";
}

export interface PublicationFile extends CatalogFile {
  hash: string;
  status: "pending" | "review" | "validated" | "archived" | "deleting";
  visibility?: string | null;
  authorization: number;
  review_note: string | null;
  metadata?: Pick<DlisMetadata, "logicalFiles"> | null;
}

export interface AnalysisSummary {
  id: string;
  hash: string;
  name: string;
  file_name: string;
  updated_at: string;
}

export interface SavedAnalysis extends AnalysisSummary {
  points: LogPoint[];
  settings?: {
    regions?: unknown;
    wellAssessment?: unknown;
    calibration?: CalibrationForm;
  };
}

export interface AccountData {
  user: UserProfile;
  analyses: AnalysisSummary[];
  history: {
    id: string;
    hash: string;
    file_id: string | null;
    file_name: string;
    accessed_at: string;
  }[];
  files: PublicationFile[];
  exports: {
    id: string;
    format: string;
    count: number;
    hash: string;
    created_at: string;
  }[];
}
