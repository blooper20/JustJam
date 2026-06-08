import apiClient from './api-client';

export interface User {
  id: number;
  email: string;
  nickname: string | null;
  profile_image: string | null;
  provider: string;
  role: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  user_id: number;
  project_id: string;
  role: 'viewer' | 'editor';
  email: string;
  nickname: string;
}

export interface Project {
  id: string;
  name: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  status_text?: string;
  created_at: string;
  progress: number;
  bpm?: number;
  members?: ProjectMember[];
  is_owner?: boolean;
  thumbnail_url?: string;
  detected_key?: string;
  chord_progression?: string;
  structure?: string;
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

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const fetchProjects = async (params?: {
  q?: string;
  sort?: string;
  team_id?: number;
}): Promise<Project[]> => {
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

export const createProject = async (file: File, teamId?: number): Promise<Project> => {
  const formData = new FormData();
  formData.append('file', file);
  if (teamId) {
    formData.append('team_id', teamId.toString());
  }

  const response = await apiClient.post('/projects/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000, // 업로드는 최대 2분까지 허용
  });
  return response.data;
};

export interface ProcessResponse {
  message: string;
  status: 'processing';
}

export const processProject = async (id: string): Promise<ProcessResponse> => {
  const response = await apiClient.post(`/projects/${id}/process`);
  return response.data;
};

export const fetchProjectStems = async (id: string): Promise<StemFiles> => {
  const response = await apiClient.get(`/projects/${id}/stems`);
  const data = response.data;

  const fixUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${SERVER_URL}${url}`;
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

export const generateMidi = async (id: string, instrument: string): Promise<Blob> => {
  const response = await apiClient.post(`/projects/${id}/midi/${instrument}`, null, {
    responseType: 'blob',
  });
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
    data.url = `${SERVER_URL}${data.url}`;
  }

  return data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}`);
};

export const shareProject = async (
  projectId: string,
  email: string,
  role: 'viewer' | 'editor' = 'viewer',
): Promise<ProjectMember> => {
  const response = await apiClient.post(`/projects/${projectId}/share`, { email, role });
  return response.data;
};

export const fetchProjectMembers = async (projectId: string): Promise<ProjectMember[]> => {
  const response = await apiClient.get(`/projects/${projectId}/members`);
  return response.data;
};

export const removeProjectMember = async (projectId: string, userId: number): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}/members/${userId}`);
};

export const uploadProfileImage = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/users/me/profile-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export interface TeamMember {
  id: number;
  team_id: number;
  user_id: number;
  role: 'owner' | 'editor' | 'viewer';
  instrument: string | null;
  created_at: string;
  email: string | null;
  nickname: string | null;
}

export interface Team {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  members: TeamMember[];
  is_owner: boolean;
}

export const fetchTeams = async (): Promise<Team[]> => {
  const response = await apiClient.get('/teams/');
  return response.data;
};

export const createTeam = async (name: string): Promise<Team> => {
  const response = await apiClient.post('/teams/', { name });
  return response.data;
};

export const fetchTeamMembers = async (teamId: number): Promise<TeamMember[]> => {
  const response = await apiClient.get(`/teams/${teamId}/members`);
  return response.data;
};

export const inviteTeamMember = async (
  teamId: number,
  email: string,
  role: string = 'viewer',
): Promise<TeamMember> => {
  const response = await apiClient.post(`/teams/${teamId}/share`, null, {
    params: { email, role },
  });
  return response.data;
};

export const updateTeamMemberInstrument = async (
  teamId: number,
  userId: number,
  instrument: string,
): Promise<TeamMember> => {
  const response = await apiClient.patch(`/teams/${teamId}/members/${userId}/instrument`, {
    instrument,
  });
  return response.data;
};
