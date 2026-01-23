'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProjectMembers, shareProject, removeProjectMember } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    X,
    UserPlus,
    Shield,
    Trash2,
    Mail,
    Loader2,
    Check,
    ShieldAlert,
    User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ShareModalProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
    isOwner: boolean;
}

export function ShareModal({ projectId, isOpen, onClose, isOwner }: ShareModalProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
    const queryClient = useQueryClient();

    const { data: members, isLoading } = useQuery({
        queryKey: ['project', projectId, 'members'],
        queryFn: () => fetchProjectMembers(projectId),
        enabled: isOpen,
    });

    const shareMutation = useMutation({
        mutationFn: () => shareProject(projectId, email, role),
        onSuccess: () => {
            toast.success('프로젝트를 성공적으로 공유했습니다.');
            setEmail('');
            queryClient.invalidateQueries({ queryKey: ['project', projectId, 'members'] });
        },
        onError: (error: any) => {
            toast.error(error.message || '공유 중 오류가 발생했습니다.');
        },
    });

    const removeMutation = useMutation({
        mutationFn: (userId: number) => removeProjectMember(projectId, userId),
        onSuccess: () => {
            toast.success('멤버가 삭제되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['project', projectId, 'members'] });
        },
        onError: (error: any) => {
            toast.error(error.message || '삭제 중 오류가 발생했습니다.');
        },
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-primary" />
                            프로젝트 공유
                        </h2>
                        <p className="text-sm text-zinc-400 mt-1">이메일로 협업자를 초대하세요.</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-zinc-800">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Invite Form */}
                    {isOwner && (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                    <Input
                                        placeholder="초대할 사용자의 이메일"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 bg-zinc-900 border-zinc-800 focus:ring-primary/20"
                                    />
                                </div>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as any)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-md px-3 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="viewer">조회</option>
                                    <option value="editor">편집</option>
                                </select>
                            </div>
                            <Button
                                onClick={() => shareMutation.mutate()}
                                disabled={!email || shareMutation.isPending}
                                className="w-full shadow-lg shadow-primary/10"
                            >
                                {shareMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <UserPlus className="w-4 h-4 mr-2" />
                                )}
                                초대장 보내기
                            </Button>
                        </div>
                    )}

                    {/* Members List */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">프로젝트 멤버</h3>
                        <div className="space-y-1 max-h-60 overflow-y-auto pr-1 thin-scrollbar">
                            {isLoading ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                                </div>
                            ) : members?.length === 0 ? (
                                <div className="text-center p-8 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                                    <User className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                                    <p className="text-sm text-zinc-500">아직 공유된 멤버가 없습니다.</p>
                                </div>
                            ) : (
                                members?.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex justify-between items-center p-3 rounded-xl hover:bg-zinc-900 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-8 h-8 border border-zinc-800">
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                    {member.nickname?.[0] || member.email[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{member.nickname || 'Unknown User'}</p>
                                                <p className="text-xs text-zinc-500 truncate">{member.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter",
                                                member.role === 'editor' ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                                            )}>
                                                {member.role === 'editor' ? '권한: 편집' : '권한: 조회'}
                                            </span>
                                            {isOwner && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all rounded-full"
                                                    onClick={() => removeMutation.mutate(member.user_id)}
                                                    disabled={removeMutation.isPending}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        비공개 프로젝트는 공유된 사용자만 접근할 수 있습니다.
                        편집 권한을 주면 악보 생성 및 설정을 변경할 수 있게 됩니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
