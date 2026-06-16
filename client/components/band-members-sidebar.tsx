'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { Loader2, MicVocal, Music, Drum, Guitar, Piano, Users, Plus, Trash2 } from 'lucide-react';
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

const INSTRUMENTS = [
  { id: 'vocal', name: 'Vocal', icon: MicVocal },
  { id: 'guitar', name: 'Guitar', icon: Guitar },
  { id: 'bass', name: 'Bass', icon: Guitar },
  { id: 'drum', name: 'Drum', icon: Drum },
  { id: 'keyboard', name: 'Keyboard', icon: Piano },
  { id: 'other', name: 'Other', icon: Music },
];

export function BandMembersSidebar({ teamId }: { teamId: number }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      const res = await apiClient.get(`/teams/${teamId}/members`);
      return res.data;
    },
    enabled: !!teamId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: searchData, isFetching: isSearching } = useQuery<any[]>({
    queryKey: ['team-search-users', teamId, inviteEmail],
    queryFn: async () => {
      if (!inviteEmail || inviteEmail.trim().length < 2) return [];
      const res = await apiClient.get(
        `/teams/${teamId}/search-users?q=${encodeURIComponent(inviteEmail.trim())}`,
      );
      return res.data;
    },
    enabled: !!teamId && inviteEmail.trim().length >= 2,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inviteMutation = useMutation({
    mutationFn: (email: string) => inviteTeamMember(teamId, email, 'editor'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      setInviteEmail('');
      setIsInviting(false);
      toast.success('Member invited successfully');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      setIsInviting(false);
      const data = err?.response?.data;
      let msg = 'Failed to invite member';
      if (data?.detail) {
        msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
      toast.error(msg);
    },
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

  const currentUserEmail = session?.user?.email;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUserId = (session?.user as any)?.id;

  // Find the current logged-in user in the band members list
  const currentMember = members?.find(
    (m) =>
      (currentUserId && String(m.user_id) === String(currentUserId)) ||
      (currentUserEmail && m.email === currentUserEmail),
  );

  const currentUserRole = currentMember?.role || 'viewer';
  const isManagerOrSubManager = currentUserRole === 'owner' || currentUserRole === 'editor';

  return (
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Band Members
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isManagerOrSubManager && (
          <div className="relative" ref={dropdownRef}>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                placeholder="Invite via email or nickname..."
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="bg-zinc-900 border-zinc-800 text-xs"
              />
              <Button
                type="submit"
                disabled={isInviting || inviteMutation.isPending || !inviteEmail.trim()}
                size="icon"
                variant="secondary"
                className="shrink-0"
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </form>

            {showDropdown && inviteEmail.trim().length >= 2 && (
              <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-3 text-zinc-500 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    검색 중...
                  </div>
                ) : searchData && searchData.length > 0 ? (
                  searchData.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setInviteEmail(user.email);
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors flex flex-col gap-0.5 border-b border-zinc-900/60 last:border-0"
                    >
                      <span className="font-bold text-zinc-200">{user.nickname}</span>
                      <span className="text-[10px] text-zinc-500">{user.email}</span>
                    </button>
                  ))
                ) : (
                  <div className="py-3 px-3 text-center text-zinc-500 text-xs">
                    검색된 가입 유저가 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {members?.map((member) => {
            const InstrumentIcon =
              INSTRUMENTS.find((i) => i.id === member.instrument)?.icon || Music;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-primary shrink-0">
                    <InstrumentIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.nickname || member.email}
                    </p>
                    <p className="text-xs text-zinc-500 capitalize truncate">{member.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const isOwnCard =
                      (currentUserId && String(member.user_id) === String(currentUserId)) ||
                      (currentUserEmail && member.email === currentUserEmail);
                    const canEditPosition = isManagerOrSubManager || isOwnCard;

                    return (
                      <Select
                        value={member.instrument || 'other'}
                        disabled={!canEditPosition}
                        onValueChange={(val) =>
                          updateInstrumentMutation.mutate({
                            userId: member.user_id,
                            instrument: val,
                          })
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
                    );
                  })()}

                  {isManagerOrSubManager && member.role !== 'owner' && (
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
