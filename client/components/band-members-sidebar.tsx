'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Loader2,
  Mic2,
  Music,
  Drum,
  Guitar,
  Keyboard,
  Users,
  Plus,
  Trash2,
  Edit2,
  Settings,
} from 'lucide-react';
import { TeamMember, inviteTeamMember, updateTeamMemberInstrument } from '@/lib/api';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BandMembersSidebarProps {
  teamId: number;
}

const INSTRUMENTS = [
  { id: 'vocal', name: 'Vocal', icon: Mic2 },
  { id: 'guitar', name: 'Guitar', icon: Guitar },
  { id: 'bass', name: 'Bass', icon: Music }, // or a custom bass icon
  { id: 'drum', name: 'Drum', icon: Drum },
  { id: 'keyboard', name: 'Keyboard', icon: Keyboard },
  { id: 'other', name: 'Other', icon: Music },
];

export function BandMembersSidebar({ teamId }: { teamId: number }) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      const res = await apiClient.get(`/teams/${teamId}/members`);
      return res.data;
    },
    enabled: !!teamId,
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => inviteTeamMember(teamId, email, 'editor'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      setInviteEmail('');
      setIsInviting(false);
      toast.success('Member invited successfully');
    },
    onError: () => toast.error('Failed to invite member'),
  });

  const updateInstrumentMutation = useMutation({
    mutationFn: ({ userId, instrument }: { userId: number; instrument: string }) =>
      updateTeamMemberInstrument(teamId, userId, instrument),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      toast.success('Instrument updated');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiClient.delete(`/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      toast.success('Member removed');
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail) {
      setIsInviting(true);
      inviteMutation.mutate(inviteEmail);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Band Members
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleInvite} className="flex gap-2">
          <Input
            placeholder="Invite via email..."
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="bg-zinc-900 border-zinc-800"
          />
          <Button
            type="submit"
            disabled={isInviting || inviteMutation.isPending}
            size="icon"
            variant="secondary"
          >
            {inviteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </form>

        <div className="space-y-4">
          {members?.map((member) => {
            const InstrumentIcon =
              INSTRUMENTS.find((i) => i.id === member.instrument)?.icon || Music;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-primary">
                    <InstrumentIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.nickname || member.email}</p>
                    <p className="text-xs text-zinc-500 capitalize">{member.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={member.instrument || 'other'}
                    onValueChange={(val) =>
                      updateInstrumentMutation.mutate({ userId: member.user_id, instrument: val })
                    }
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs bg-zinc-950 border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTRUMENTS.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id} className="text-xs">
                          {inst.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {member.role !== 'owner' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-red-500"
                      onClick={() => removeMemberMutation.mutate(member.user_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
