import apiClient from './api-client';

export interface Project {
  id: string;
  name: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  progress: number;
  bpm?: number;
  has_score?: boolean;
  has_tab?: boolean;
  score_instruments?: string[];
  tab_instruments?: string[];
}

export interface StemFiles {
  vocals: string | null;
  bass: string | null;
  drums: string | null;
  guitar: string | null;
  piano: string | null;
  other: string | null;
  master: string | null;
}

export interface TabResponse {
  project_id: string;
  instrument: string;
  bpm: number;
  tab: string;
  notes_count: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const fetchProjects = async (params?: { q?: string; sort?: string }): Promise<Project[]> => {
  const response = await apiClient.get('/projects/', { params });
  return response.data;
};

export const updateProject = async (id: string, data: { name: string }): Promise<Project> => {
  const response = await apiClient.patch(`/projects/${id}`, data);
  return response.data;
};

export const cloneProject = async (id: string): Promise<Project> => {
  const response = await apiClient.post(`/projects/${id}/clone`);
  return response.data;
};

export const fetchProject = async (id: string): Promise<Project> => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (file: File): Promise<Project> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/projects/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const processProject = async (id: string): Promise<Project> => {
  const response = await apiClient.post(`/projects/${id}/process`);
  return response.data;
};

export const fetchProjectStems = async (id: string): Promise<StemFiles> => {
  const response = await apiClient.get(`/projects/${id}/stems`);
  const data = response.data;

  const fixUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };

  return {
    vocals: fixUrl(data.vocals),
    bass: fixUrl(data.bass),
    drums: fixUrl(data.drums),
    guitar: fixUrl(data.guitar),
    piano: fixUrl(data.piano),
    other: fixUrl(data.other),
    master: fixUrl(data.master),
  };
};

export const generateScore = async (id: string, instrument: string): Promise<string> => {
  const response = await apiClient.post(`/projects/${id}/score/${instrument}`);
  // Assuming backend returns string content for score or path, checking original it was text
  // If it's returning raw text/xml content:
  if (typeof response.data === 'string') return response.data;
  // If object?
  return JSON.stringify(response.data);
};

export const generateTab = async (id: string, instrument: string): Promise<TabResponse> => {
  const response = await apiClient.post(`/projects/${id}/tabs/${instrument}`);
  return response.data;
};

export const downloadMix = async (
  id: string,
  volumes: Record<string, number>,
  bpm: number = 120,
  metronomeVolume: number = 0,
  startOffset: number = 0,
): Promise<{ url: string }> => {
  const response = await apiClient.post(`/projects/${id}/mix`, {
    volumes,
    bpm,
    metronome: metronomeVolume,
    start_offset: startOffset,
  });
  const data = response.data;

  // Fix URL if relative
  if (data.url && !data.url.startsWith('http')) {
    data.url = `${API_BASE_URL}${data.url}`;
  }

  return data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}`);
};
