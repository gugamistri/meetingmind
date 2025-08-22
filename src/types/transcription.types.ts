/**
 * Transcription-related TypeScript type definitions
 * 
 * These types extend the basic meeting types to include detailed transcription
 * data needed for the meeting detail view and editing functionality.
 */

// Speaker identification for transcription segments
export interface Speaker {
  readonly id: number;
  readonly name?: string;
  readonly email?: string;
  readonly colorHex: string;
  readonly voiceFingerprint?: ArrayBuffer;
  readonly totalMeetings: number;
  readonly lastSeen: Date;
}

// Individual transcription segment with speaker and timing information
export interface TranscriptionSegment {
  readonly id: number;
  readonly transcriptionId: number;
  readonly speakerId?: number;
  readonly text: string;
  readonly startTimestamp: number;
  readonly endTimestamp: number;
  readonly confidence: number;
  readonly isEdited: boolean;
  readonly speaker?: Speaker;
}

// Complete transcription with segments
export interface DetailedTranscription {
  readonly id: number;
  readonly meetingId: number;
  readonly content: string;
  readonly confidence: number;
  readonly language: string;
  readonly modelUsed: string;
  readonly createdAt: Date;
  readonly segments: TranscriptionSegment[];
  readonly speakers: Speaker[];
  readonly totalDuration: number;
  readonly processingTimeMs: number;
  readonly processedLocally: boolean;
}

// Transcription editing operations
export interface TranscriptionEdit {
  readonly segmentId: number;
  readonly newText: string;
  readonly speakerId?: number;
}

// Search within transcription
export interface TranscriptionSearch {
  readonly query: string;
  readonly caseSensitive?: boolean;
  readonly wholeWord?: boolean;
  readonly regex?: boolean;
}

export interface TranscriptionSearchResult {
  readonly segmentId: number;
  readonly text: string;
  readonly startTimestamp: number;
  readonly endTimestamp: number;
  readonly matchStart: number;
  readonly matchEnd: number;
  readonly context?: string;
}

// Export types for transcription data
export enum ExportFormat {
  Markdown = 'markdown',
  PDF = 'pdf',
  DOCX = 'docx',
  JSON = 'json',
  TXT = 'txt',
}

export interface ExportOptions {
  readonly format: ExportFormat;
  readonly includeTimestamps?: boolean;
  readonly includeSpeakers?: boolean;
  readonly includeConfidenceScores?: boolean;
  readonly includeMetadata?: boolean;
  readonly dateFormat?: string;
  readonly template?: string;
}

export interface ExportResult {
  readonly filePath: string;
  readonly downloadUrl?: string;
  readonly expiresAt?: Date;
  readonly format: ExportFormat;
  readonly sizeBytes: number;
}

// Utility functions for transcription data
export const formatTimestamp = (timestamp: number): string => {
  const hours = Math.floor(timestamp / 3600);
  const minutes = Math.floor((timestamp % 3600) / 60);
  const seconds = Math.floor(timestamp % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const getSegmentDuration = (segment: TranscriptionSegment): number => {
  return segment.endTimestamp - segment.startTimestamp;
};

export const formatSegmentDuration = (segment: TranscriptionSegment): string => {
  return formatTimestamp(getSegmentDuration(segment));
};

export const getSpeakerColor = (speaker: Speaker): string => {
  return speaker.colorHex || '#6B7280';
};

export default {
  ExportFormat,
  formatTimestamp,
  getSegmentDuration,
  formatSegmentDuration,
  getSpeakerColor,
};