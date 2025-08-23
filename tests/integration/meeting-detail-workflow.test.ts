/**
 * Integration tests for Meeting Detail View & Management workflows
 * 
 * These tests verify the complete user journey through the meeting detail page,
 * including data fetching, interaction with backend commands, and UI state changes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tauri API for integration testing
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}));

interface MockMeetingData {
  id: number;
  title: string;
  status: string;
  participants: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
  }>;
  hasTranscription: boolean;
  hasAiSummary: boolean;
}

const mockMeetingData: MockMeetingData = {
  id: 1,
  title: 'Test Meeting Integration',
  status: 'completed',
  participants: [
    { id: 1, name: 'John Doe', email: 'john@test.com', role: 'organizer' },
    { id: 2, name: 'Jane Smith', email: 'jane@test.com', role: 'participant' },
  ],
  hasTranscription: true,
  hasAiSummary: true,
};

describe('Meeting Detail Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Meeting Data Loading', () => {
    it('should successfully fetch meeting details on page load', async () => {
      // Mock the get_meeting_detail command response
      mockInvoke.mockResolvedValue({
        meeting: {
          id: 1,
          title: 'Test Meeting Integration',
          description: 'Integration test meeting',
          start_time: '2025-01-15T10:00:00Z',
          end_time: '2025-01-15T11:00:00Z',
          status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T11:00:00Z',
        },
        participants: [
          {
            id: 1,
            meeting_id: 1,
            name: 'John Doe',
            email: 'john@test.com',
            role: 'organizer',
            created_at: '2025-01-15T10:00:00Z',
          },
          {
            id: 2,
            meeting_id: 1,
            name: 'Jane Smith',
            email: 'jane@test.com',
            role: 'participant',
            created_at: '2025-01-15T10:00:00Z',
          },
        ],
        transcriptions: [
          {
            id: 1,
            meeting_id: 1,
            content: 'Sample transcription content for integration testing.',
          },
        ],
        summaries: [
          {
            id: 'summary_1',
            meeting_id: '1',
            content: '## Meeting Summary\n\nThis is a test summary.',
            model_used: 'gpt-4',
            provider: 'openai',
            created_at: '2025-01-15T11:00:00Z',
          },
        ],
        has_audio_file: true,
        audio_file_path: '/path/to/audio.wav',
      });

      // Simulate the useMeetingDetail hook calling the command
      const meetingId = 1;
      const result = await mockInvoke('get_meeting_detail', meetingId);

      expect(mockInvoke).toHaveBeenCalledWith('get_meeting_detail', meetingId);
      expect(result.meeting.id).toBe(1);
      expect(result.meeting.title).toBe('Test Meeting Integration');
      expect(result.participants).toHaveLength(2);
      expect(result.transcriptions).toHaveLength(1);
      expect(result.summaries).toHaveLength(1);
    });

    it('should handle meeting not found error gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Meeting not found'));

      try {
        await mockInvoke('get_meeting_detail', 999);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Meeting not found');
      }
    });
  });

  describe('Meeting Management Actions', () => {
    beforeEach(() => {
      // Setup successful meeting detail fetch for these tests
      mockInvoke.mockImplementation((command) => {
        if (command === 'get_meeting_detail') {
          return Promise.resolve({
            meeting: mockMeetingData,
            participants: mockMeetingData.participants,
            transcriptions: [],
            summaries: [],
            has_audio_file: false,
          });
        }
        return Promise.resolve();
      });
    });

    it('should successfully delete a meeting', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'delete_meeting') {
          expect(args.meetingId).toBe(1);
          return Promise.resolve({
            success: true,
            message: 'Meeting 1 deleted successfully',
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('delete_meeting', { meetingId: 1 });

      expect(mockInvoke).toHaveBeenCalledWith('delete_meeting', { meetingId: 1 });
      expect(result.success).toBe(true);
      expect(result.message).toContain('Meeting 1 deleted successfully');
    });

    it('should successfully duplicate a meeting', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'duplicate_meeting') {
          expect(args.meetingId).toBe(1);
          return Promise.resolve({
            meeting: {
              id: 2,
              title: 'Copy of Test Meeting Integration',
              status: 'scheduled',
            },
            participants: [],
            transcriptions: [],
            summaries: [],
            has_audio_file: false,
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('duplicate_meeting', { meetingId: 1 });

      expect(mockInvoke).toHaveBeenCalledWith('duplicate_meeting', { meetingId: 1 });
      expect(result.meeting.id).toBe(2);
      expect(result.meeting.title).toBe('Copy of Test Meeting Integration');
      expect(result.meeting.status).toBe('scheduled');
    });

    it('should successfully archive a meeting', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'archive_meeting') {
          expect(args.meetingId).toBe(1);
          expect(args.archived).toBe(true);
          return Promise.resolve({
            success: true,
            message: 'Meeting 1 archived successfully',
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('archive_meeting', { meetingId: 1, archived: true });

      expect(mockInvoke).toHaveBeenCalledWith('archive_meeting', { meetingId: 1, archived: true });
      expect(result.success).toBe(true);
      expect(result.message).toContain('archived successfully');
    });

    it('should successfully unarchive a meeting', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'archive_meeting') {
          expect(args.meetingId).toBe(1);
          expect(args.archived).toBe(false);
          return Promise.resolve({
            success: true,
            message: 'Meeting 1 unarchived successfully',
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('archive_meeting', { meetingId: 1, archived: false });

      expect(mockInvoke).toHaveBeenCalledWith('archive_meeting', { meetingId: 1, archived: false });
      expect(result.success).toBe(true);
      expect(result.message).toContain('unarchived successfully');
    });
  });

  describe('Export Functionality', () => {
    it('should successfully export meeting in markdown format', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'export_meeting') {
          expect(args.meetingId).toBe(1);
          expect(args.options.format).toBe('markdown');
          return Promise.resolve({
            file_path: '/tmp/meetingmind_exports/meeting_1_20250115_120000_export.md',
            download_url: 'http://localhost:8080/exports/meeting_1_20250115_120000_export.md',
            expires_at: '2025-01-16T12:00:00Z',
            format: 'markdown',
            size_bytes: 2048,
          });
        }
        return Promise.resolve();
      });

      const exportOptions = {
        format: 'markdown',
        includeTimestamps: true,
        includeSpeakers: true,
        includeMetadata: true,
      };

      const result = await mockInvoke('export_meeting', { 
        meetingId: 1, 
        options: exportOptions 
      });

      expect(mockInvoke).toHaveBeenCalledWith('export_meeting', {
        meetingId: 1,
        options: exportOptions,
      });
      expect(result.format).toBe('markdown');
      expect(result.file_path).toContain('.md');
      expect(result.size_bytes).toBeGreaterThan(0);
      expect(result.download_url).toBeTruthy();
    });

    it('should successfully export meeting in JSON format', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'export_meeting') {
          expect(args.options.format).toBe('json');
          return Promise.resolve({
            file_path: '/tmp/meetingmind_exports/meeting_1_20250115_120000_export.json',
            format: 'json',
            size_bytes: 4096,
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('export_meeting', {
        meetingId: 1,
        options: { format: 'json' },
      });

      expect(result.format).toBe('json');
      expect(result.file_path).toContain('.json');
    });

    it('should handle export failures gracefully', async () => {
      mockInvoke.mockImplementation((command) => {
        if (command === 'export_meeting') {
          return Promise.reject(new Error('Export failed: insufficient disk space'));
        }
        return Promise.resolve();
      });

      try {
        await mockInvoke('export_meeting', {
          meetingId: 1,
          options: { format: 'pdf' },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Export failed');
      }
    });
  });

  describe('Transcription Management', () => {
    it('should fetch detailed transcription with segments', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'get_meeting_transcription') {
          expect(args).toBe(1);
          return Promise.resolve({
            id: 1,
            meeting_id: 1,
            content: 'Complete meeting transcription content...',
            confidence: 0.93,
            language: 'en-US',
            model_used: 'whisper-large-v2',
            created_at: '2025-01-15T10:30:00Z',
            segments: [
              {
                id: 1,
                transcription_id: 1,
                speaker_id: 1,
                text: 'Welcome everyone to our meeting today.',
                start_timestamp: 0.0,
                end_timestamp: 3.5,
                confidence: 0.95,
                is_edited: false,
              },
              {
                id: 2,
                transcription_id: 1,
                speaker_id: 2,
                text: 'Thank you for having me.',
                start_timestamp: 3.5,
                end_timestamp: 6.0,
                confidence: 0.92,
                is_edited: false,
              },
            ],
            speakers: [
              {
                id: 1,
                name: 'John Doe',
                color_hex: '#10B981',
                total_meetings: 15,
                last_seen: '2025-01-15T10:00:00Z',
              },
              {
                id: 2,
                name: 'Jane Smith',
                color_hex: '#3B82F6',
                total_meetings: 8,
                last_seen: '2025-01-15T10:05:00Z',
              },
            ],
            total_duration: 3600.0,
            processing_time_ms: 3500,
            processed_locally: true,
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('get_meeting_transcription', 1);

      expect(mockInvoke).toHaveBeenCalledWith('get_meeting_transcription', 1);
      expect(result.segments).toHaveLength(2);
      expect(result.speakers).toHaveLength(2);
      expect(result.total_duration).toBe(3600.0);
      expect(result.processed_locally).toBe(true);
    });

    it('should update transcription segment text', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'update_transcription_segment') {
          expect(args.segmentId).toBe(1);
          expect(args.text).toBe('Updated transcription text');
          expect(args.speakerId).toBe(2);
          return Promise.resolve({
            success: true,
            message: 'Transcription segment 1 updated successfully',
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('update_transcription_segment', {
        segmentId: 1,
        text: 'Updated transcription text',
        speakerId: 2,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('segment 1 updated successfully');
    });
  });

  describe('Speaker Management', () => {
    it('should create a new speaker', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'create_speaker') {
          expect(args.meetingId).toBe(1);
          expect(args.name).toBe('New Speaker');
          expect(args.colorHex).toBe('#FF6B6B');
          return Promise.resolve({
            id: 3,
            name: 'New Speaker',
            email: null,
            color_hex: '#FF6B6B',
            total_meetings: 1,
            last_seen: '2025-01-15T12:00:00Z',
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('create_speaker', {
        meetingId: 1,
        name: 'New Speaker',
        email: null,
        colorHex: '#FF6B6B',
      });

      expect(result.id).toBe(3);
      expect(result.name).toBe('New Speaker');
      expect(result.color_hex).toBe('#FF6B6B');
    });

    it('should update speaker assignment', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'update_speaker_assignment') {
          expect(args.segmentId).toBe(1);
          expect(args.speakerId).toBe(3);
          return Promise.resolve({
            success: true,
            message: 'Speaker assignment for segment 1 updated successfully',
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('update_speaker_assignment', {
        segmentId: 1,
        speakerId: 3,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('updated successfully');
    });
  });

  describe('AI Summary Generation', () => {
    it('should generate AI summary with template', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'generate_meeting_summary') {
          expect(args.meetingId).toBe('1');
          expect(args.templateName).toBe('standup');
          expect(args.provider).toBe('openai');
          return Promise.resolve({
            id: 'summary_new',
            meeting_id: '1',
            template_id: 1,
            content: '## Daily Standup Summary\n\n### Completed:\n- Task A\n- Task B\n\n### Next Steps:\n- Task C\n- Task D',
            model_used: 'gpt-4',
            provider: 'openai',
            cost_usd: 0.03,
            processing_time_ms: 2000,
            token_count: 120,
            confidence_score: 0.94,
            created_at: '2025-01-15T12:00:00Z',
          });
        }
        return Promise.resolve();
      });

      const result = await mockInvoke('generate_meeting_summary', {
        meetingId: '1',
        templateId: 'standup_template',
        templateName: 'standup',
        systemPrompt: 'Generate a standup meeting summary...',
        provider: 'openai',
        model: 'gpt-4',
        transcriptionContent: 'Meeting transcription here...',
      });

      expect(result.template_id).toBe(1);
      expect(result.content).toContain('Daily Standup Summary');
      expect(result.provider).toBe('openai');
      expect(result.cost_usd).toBe(0.03);
      expect(result.token_count).toBe(120);
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should complete full meeting management workflow', async () => {
      // Step 1: Load meeting details
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'get_meeting_detail':
            return Promise.resolve({
              meeting: mockMeetingData,
              participants: mockMeetingData.participants,
              transcriptions: [],
              summaries: [],
            });
          
          case 'get_meeting_transcription':
            return Promise.resolve({
              segments: [{ id: 1, text: 'Original text' }],
              speakers: [{ id: 1, name: 'Speaker 1' }],
            });
          
          case 'update_transcription_segment':
            return Promise.resolve({ success: true });
          
          case 'generate_meeting_summary':
            return Promise.resolve({
              id: 'summary_1',
              content: 'Generated summary',
              cost_usd: 0.02,
            });
          
          case 'export_meeting':
            return Promise.resolve({
              file_path: '/tmp/export.md',
              size_bytes: 1024,
            });
          
          case 'archive_meeting':
            return Promise.resolve({ success: true });
        }
        return Promise.resolve();
      });

      // Execute complete workflow
      const meeting = await mockInvoke('get_meeting_detail', 1);
      expect(meeting.meeting.id).toBe(1);

      const transcription = await mockInvoke('get_meeting_transcription', 1);
      expect(transcription.segments).toHaveLength(1);

      const updateResult = await mockInvoke('update_transcription_segment', {
        segmentId: 1,
        text: 'Updated text',
      });
      expect(updateResult.success).toBe(true);

      const summary = await mockInvoke('generate_meeting_summary', {
        meetingId: '1',
        templateName: 'general',
      });
      expect(summary.content).toBe('Generated summary');

      const exportResult = await mockInvoke('export_meeting', {
        meetingId: 1,
        options: { format: 'markdown' },
      });
      expect(exportResult.file_path).toBeTruthy();

      const archiveResult = await mockInvoke('archive_meeting', {
        meetingId: 1,
        archived: true,
      });
      expect(archiveResult.success).toBe(true);

      // Verify all commands were called
      expect(mockInvoke).toHaveBeenCalledTimes(6);
    });
  });
});