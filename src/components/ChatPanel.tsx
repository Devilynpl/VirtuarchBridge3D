'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Asset } from '@/lib/assets';
import toast from 'react-hot-toast';
import { encryptMessage, decryptMessage } from '@/lib/crypto';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSecureTransfer } from '@/hooks/useSecureTransfer';
import { computeKeyFingerprint } from '@/lib/transferCrypto';
import {
    Send, Upload, X, Copy, Check, MessageSquare,
    Globe, Zap, Users, UserPlus, MoreVertical, LogOut,
    User as UserIcon, Loader2, Activity,
    Box, Megaphone, AlertCircle, ChevronRight, Plus, Lock, ShieldCheck, Download, RefreshCcw,
    Mic, MicOff, Phone, PhoneOff, Volume2
} from 'lucide-react';
import { getIceConfig } from '@/lib/p2pConfig';

// We need to dynamically import PeerJS to avoid SSR issues
interface Message {
    id: string;
    sender: string;
    sender_id?: string;
    text?: string;
    file?: {
        name: string;
        size: number;
        type: string;
        blob: Blob;
    };
    timestamp: number;
    isSelf: boolean;
    type?: string;
    metadata?: any;
}

export default function ChatPanel() {
    const { user, logout, token, keyPair } = useAuth();
    const { t, language } = useLanguage();
    const { sendEncryptedAssets, receiveEncryptedAssets, isSending, isReceiving, progress } = useSecureTransfer();
    const [sendEncryptedModal, setSendEncryptedModal] = useState<{ open: boolean; assetIds: string[]; assetName: string } | null>(null);

    // UI States
    const [peerId, setPeerId] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    const [requestData, setRequestData] = useState({ name: '', type: '3D Asset' });
    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState<any[]>([]);
    const [friendId, setFriendId] = useState('');
    const [roomUsers, setRoomUsers] = useState<any[]>([]);
    const [activeConvId, setActiveConvId] = useState('00000000-0000-0000-0000-000000000001');
    const [activeConvName, setActiveConvName] = useState('General Chat');
    const [activeConvTopic, setActiveConvTopic] = useState<string | null>(null);
    const [activeConvCreatorId, setActiveConvCreatorId] = useState<string | null>(null);
    const [activeConvCreatorName, setActiveConvCreatorName] = useState<string | null>(null);
    const [activeConvCreatedAt, setActiveConvCreatedAt] = useState<string | null>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [newChannelName, setNewChannelName] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, visible: boolean, targetUser: any } | null>(null);

    const DEFAULT_CONV_ID = '00000000-0000-0000-0000-000000000001';

    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [isMuted, setIsMuted] = useState(false);
    const callsRef = useRef<Record<string, any>>({});

    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const initializingRef = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch Contacts & Conversations
    useEffect(() => {
        if (token) {
            fetchChatData();
        }
    }, [token, activeConvId]);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const fetchChatData = async () => {
        try {
            const [contactsRes, convsRes] = await Promise.all([
                fetch('/api/contacts', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (contactsRes.ok) {
                const data = await contactsRes.json();
                setContacts(data.contacts);
            }
            if (convsRes.ok) {
                const data = await convsRes.json();
                setConversations(data.conversations);
                const active = data.conversations.find((c: any) => c.id === activeConvId);
                if (active) {
                    setActiveConvCreatorId(active.created_by);
                    setActiveConvTopic(active.description);
                    setActiveConvCreatedAt(active.created_at);
                    const owner = active.members?.find((m: any) => m.role === 'owner')?.user?.username;
                    setActiveConvCreatorName(owner || 'System');
                }
            }
        } catch (err) {
            console.error('Failed to fetch chat data:', err);
        }
    };

    const addContact = async () => {
        if (!friendId) return;
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ peer_id: friendId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('chat.contact_added'));
                setContacts(prev => [data.contact, ...prev]);
                setFriendId('');
            } else {
                toast.error(data.error || t('chat.contact_failed'));
            }
        } catch (err) {
            toast.error(t('chat.network_error'));
        }
    };

    // Messages Fetching
    useEffect(() => {
        if (!user || !activeConvId) return;
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const processedMessages = await Promise.all(data.messages.map(async (m: any) => {
                        let text = m.content;
                        let metadata = m.metadata ? (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata) : null;
                        if (metadata?.nonce && metadata?.sender_publicKey && keyPair) {
                            const decrypted = await decryptMessage(m.content, metadata.nonce, metadata.sender_publicKey, keyPair.privateKey);
                            if (decrypted) text = decrypted;
                        }
                        return {
                            id: m.id,
                            sender: m.sender?.username || t('chat.system'),
                            sender_id: m.sender?.id,
                            text: text,
                            timestamp: new Date(m.created_at).getTime(),
                            isSelf: m.sender?.id === user.id,
                            type: m.type,
                            metadata: metadata
                        };
                    }));
                    setMessages(processedMessages);
                }
            } catch (err) { console.warn('History fetch fail:', err); }
        };
        fetchHistory();
        const interval = setInterval(fetchHistory, 3000);
        return () => clearInterval(interval);
    }, [user, activeConvId, keyPair, token, t]);

    // PeerJS Init
    useEffect(() => {
        let active = true;
        let retryCount = 0;
        const maxRetries = 3;

        const initPeer = async () => {
            if (peerRef.current || initializingRef.current || !user?.peer_id) return;
            initializingRef.current = true;
            try {
                const peerModule = await import('peerjs');
                if (!active) { initializingRef.current = false; return; }
                const Peer = peerModule.Peer || peerModule.default || peerModule;

                // Get dynamic port from Electron
                const localP2pPort = await (window as any).electron?.getP2PPort();
                const iceConfig = getIceConfig();

                console.log('[P2P] Initializing with ICE Servers:', iceConfig.iceServers.length);

                const peer = new Peer(user.peer_id, {
                    host: '127.0.0.1',
                    port: localP2pPort || 9010,
                    path: '/peerjs/bridge',
                    secure: false,
                    debug: 3,
                    pingInterval: 5000,
                    config: iceConfig
                });
                peer.on('open', (id) => {
                    if (!active) { peer.destroy(); return; }
                    setPeerId(id);
                    setLoading(false);
                    peerRef.current = peer;
                    initializingRef.current = false;
                    setIsConnected(true);
                    retryCount = 0; // Reset on success
                });
                peer.on('connection', (conn) => { if (active) handleConnection(conn); });
                peer.on('call', (call) => {
                    if (!active) return;
                    console.log('[P2P] Incoming call from:', call.peer);

                    toast((t) => (
                        <div className="flex items-center gap-4 bg-slate-900 border border-white/10 p-4 rounded-2xl shadow-2xl">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                                <Phone className="w-5 h-5 animate-bounce" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-white uppercase tracking-widest">
                                    {language === 'pl' ? 'Połączenie głosowe' : 'Incoming Call'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{call.peer.substring(0, 8)}...</p>
                            </div>
                            <div className="flex gap-2 ml-2">
                                <button
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        startVoiceChat(call);
                                    }}
                                    className="px-4 py-2 bg-accent text-slate-950 rounded-xl text-[10px] font-black uppercase hover:bg-accent-hover transition-all"
                                >
                                    Join
                                </button>
                                <button
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        call.close();
                                    }}
                                    className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-black uppercase hover:bg-red-500/20 transition-all"
                                >
                                    Ignore
                                </button>
                            </div>
                        </div>
                    ), { duration: 10000, position: 'top-right' });
                });
                peer.on('error', (err) => {
                    if (!active) return;
                    console.error('PeerJS error:', err.type, err);

                    if (['invalid-id', 'invalid-key', 'ssl-unavailable', 'server-error'].includes(err.type)) {
                        setLoading(false);
                        initializingRef.current = false;
                        return;
                    }

                    // Auto-retry for network issues
                    if (retryCount < maxRetries && !peer.destroyed) {
                        retryCount++;
                        const delay = Math.pow(2, retryCount) * 1000;
                        console.log(`[P2P] Connection failed, retrying in ${delay}ms (Attempt ${retryCount}/${maxRetries})`);
                        setTimeout(() => {
                            if (active && !peerRef.current) initPeer();
                        }, delay);
                    } else if (retryCount >= maxRetries) {
                        toast.error('P2P connection failed. Check your firewall/network settings.');
                        setLoading(false);
                        initializingRef.current = false;
                    }
                });
                peer.on('disconnected', () => {
                    setIsConnected(false);
                    if (!peer.destroyed) {
                        console.log('[P2P] Disconnected, attempting reconnection...');
                        peer.reconnect();
                    }
                });
            } catch (err) {
                console.error('PeerJS init failed', err);
                setLoading(false);
                initializingRef.current = false;
            }
        };
        if (mounted && user?.peer_id && !peerRef.current) initPeer();
        return () => { active = false; if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; initializingRef.current = false; setIsConnected(false); } };
    }, [mounted, user?.id, user?.peer_id]);

    const startVoiceChat = async (incomingCall?: any) => {
        if (isVoiceActive) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            setIsVoiceActive(true);
            setIsMuted(false);

            if (incomingCall) {
                incomingCall.answer(stream);
                handleCall(incomingCall);
                toast.success(language === 'pl' ? 'Dołączono do rozmowy' : 'Joined voice chat');
            } else {
                toast.success(language === 'pl' ? 'Rozpoczęto rozmowę głosową' : 'Voice chat started');
                // In a conversation? Call active members
                if (activeConvId !== DEFAULT_CONV_ID) {
                    const onlineMembers = roomUsers.filter(u => u.id !== user?.id && !u.isOffline);
                    onlineMembers.forEach(u => {
                        if (u.peer_id) {
                            const call = peerRef.current.call(u.peer_id, stream);
                            handleCall(call);
                        }
                    });
                } else if (connRef.current) {
                    // Direct call
                    const call = peerRef.current.call(connRef.current.peer, stream);
                    handleCall(call);
                }
            }
        } catch (err) {
            console.error('Failed to get local stream', err);
            toast.error(language === 'pl' ? 'Nie można uruchomić mikrofonu' : 'Failed to access microphone');
        }
    };

    const handleCall = (call: any) => {
        callsRef.current[call.peer] = call;
        call.on('stream', (remoteStream: MediaStream) => {
            setRemoteStreams(prev => ({ ...prev, [call.peer]: remoteStream }));
        });
        call.on('close', () => {
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[call.peer];
                return newStreams;
            });
            delete callsRef.current[call.peer];
        });
        call.on('error', (err: any) => {
            console.error('Call error:', err);
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[newStreams[call.peer] as any]; // Fix potential typing issue
                delete (newStreams as any)[call.peer];
                return newStreams;
            });
            delete callsRef.current[call.peer];
        });
    };

    const endVoiceChat = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        Object.values(callsRef.current).forEach((call: any) => call.close());
        callsRef.current = {};
        setRemoteStreams({});
        setIsVoiceActive(false);
        toast(language === 'pl' ? 'Rozmowa zakończona' : 'Voice chat ended');
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const handleConnection = (conn: any) => {
        if (connRef.current) connRef.current.close();
        connRef.current = conn;
        setIsConnected(true);
        toast.success(t('chat.connected_to').replace('{id}', conn.peer.substring(0, 5)));
        conn.on('data', (data: any) => handleIncomingData(data));
        conn.on('close', () => { setIsConnected(false); connRef.current = null; });
    };

    const handleIncomingData = async (data: any) => {
        if (data.type === 'message') {
            setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), sender: t('chat.peer'), text: data.text, timestamp: Date.now(), isSelf: false }].slice(-50));
        } else if (data.type === 'file') {
            const blob = new Blob([data.file], { type: data.fileType });
            setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), sender: t('chat.peer'), file: { name: data.fileName, size: data.fileSize, type: data.fileType, blob: blob }, timestamp: Date.now(), isSelf: false }].slice(-50));
        }
    };

    const sendMessage = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || !user) return;

        // Command processing
        if (trimmed.startsWith('/')) {
            const parts = trimmed.split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1).join(' ');

            if (command === '/topic') {
                if (activeConvId !== DEFAULT_CONV_ID && activeConvCreatorId !== user.id) {
                    toast.error(language === 'pl' ? 'Tylko założyciel kanału może zmienić temat' : 'Only the channel creator can change the topic');
                    return;
                }
                try {
                    const res = await fetch(`/api/conversations/${activeConvId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ topic: args })
                    });
                    if (res.ok) {
                        toast.success(language === 'pl' ? 'Zmieniono temat kanału' : 'Channel topic updated');
                        setActiveConvTopic(args);
                        setInputValue('');
                    }
                } catch { toast.error('Error updating topic'); }
                return;
            }

            if (['/invite', '/kick', '/ban', '/op', '/voice', '/exterminate', '/script'].includes(command)) {
                if (activeConvId !== DEFAULT_CONV_ID && activeConvCreatorId !== user.id) {
                    toast.error(language === 'pl' ? 'Brak uprawnień' : 'Permission denied');
                    return;
                }
                const targetName = parts[1];
                let systemContent = '';
                if (command === '/invite') systemContent = `🟢 INVITATION -> ${args || 'New User'}`;
                else if (command === '/kick') systemContent = `🦶 KICK -> ${targetName} was kicked.`;
                else if (command === '/ban') systemContent = `🔨 BAN -> ${targetName} was banned.`;
                else if (command === '/op') systemContent = `⭐ OP -> @${targetName} is now an Operator.`;
                else if (command === '/voice') systemContent = `🗣️ VOICE -> +${targetName} can now speak.`;
                else if (command === '/exterminate') systemContent = `☢️ EXTERMINATE -> Bot disconnection sequence initiated.`;
                else if (command === '/script') systemContent = `📜 SCRIPT -> Executing ${args}...`;

                try {
                    const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ content: systemContent, type: 'system' })
                    });
                    if (res.ok) setInputValue('');
                } catch { toast.error('Command failed'); }
                return;
            }
        }

        try {
            let content = inputValue;
            let metadata: any = null;
            const activeConv = conversations.find(c => c.id === activeConvId);
            if (activeConv?.type === 'direct' && keyPair) {
                const recipientId = activeConv.members?.find((m: any) => m.user_id !== user.id)?.user_id;
                const recipient = contacts.find(c => c.contact.id === recipientId)?.contact;
                if (recipient?.public_key) {
                    const encrypted = await encryptMessage(inputValue, recipient.public_key, keyPair.privateKey);
                    content = encrypted.cipherText;
                    metadata = { nonce: encrypted.nonce, sender_publicKey: keyPair.publicKey };
                }
            }

            // Bot commands interception
            if (content.startsWith('/Exterminate') || content.startsWith('/script')) {
                const isOp = activeConvCreatorId === user?.id || (roomUsers.find(u => u.id === user?.id)?.role === 'owner');
                if (!isOp) {
                    toast.error('Only operators can use bot commands');
                    return;
                }

                // Check if bot is in the session
                const botUser = roomUsers.find(u => u.peer_id === 'bot-mega-123');
                if (botUser) {
                    // Start PeerJS connection if not already connected
                    const conn = peerRef.current?.connect(botUser.peer_id);
                    conn?.on('open', () => {
                        const parts = content.split(' ');
                        const command = parts[0];
                        const args = parts.slice(1);
                        conn.send({ type: 'CHAT_COMMAND', command, args, sender: user?.username });
                    });
                }
            }

            const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ content, type: 'text', metadata })
            });

            if (res.ok) {
                setMessages(prev => [...prev, { id: Date.now().toString(), sender: user.username || t('chat.me'), text: inputValue, timestamp: Date.now(), isSelf: true }].slice(-50));
                setInputValue('');
            }
        } catch (err) {
            if (isConnected && connRef.current) {
                connRef.current.send({ type: 'message', text: inputValue });
                setMessages(prev => [...prev, { id: Date.now().toString(), sender: user.username || t('chat.me'), text: inputValue, timestamp: Date.now(), isSelf: true }].slice(-50));
                setInputValue('');
            }
        }
    };

    const createChannel = async () => {
        if (!newChannelName.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'channel', name: newChannelName, is_private: true, member_ids: selectedMembers })
            });
            if (res.ok) {
                const data = await res.json();
                setConversations(prev => [data.conversation, ...prev]);
                setActiveConvId(data.conversation.id);
                setActiveConvName(data.conversation.name);
                setActiveConvCreatorId(user?.id || null);
                setIsCreateModalOpen(false);
                setNewChannelName('');
                setSelectedMembers([]);
                toast.success('ShareChannel Created');
            }
        } finally { setLoading(false); }
    };

    const leaveChannel = async (id: string, name: string) => {
        try {
            const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                toast.success(`You left #${name}`);
                setConversations(prev => prev.filter(c => c.id !== id));
                if (activeConvId === id) { setActiveConvId(DEFAULT_CONV_ID); setActiveConvName('General Chat'); }
            }
        } catch { toast.error('Failed to leave'); }
    };

    const startDirectMessage = async (u: any) => {
        try {
            const res = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'direct', member_ids: [u.id] })
            });
            if (res.ok) {
                const data = await res.json();
                setActiveConvId(data.conversation.id);
                setActiveConvName(u.username);
            }
        } catch { toast.error('Failed to start chat'); }
    };

    const kickUser = async (targetUserId: string) => {
        try {
            const res = await fetch(`/api/conversations/${activeConvId}/members?userId=${targetUserId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('User kicked');
                fetchChatData();
            }
        } catch { toast.error('Failed to kick'); }
    };

    const inviteUser = async (targetUserId: string) => {
        try {
            const res = await fetch(`/api/conversations/${activeConvId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ user_id: targetUserId })
            });
            if (res.ok) {
                toast.success('User invited');
                fetchChatData();
                setIsInviteModalOpen(false);
            }
        } catch { toast.error('Invite failed'); }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !isConnected || !connRef.current) return;
        connRef.current.send({ type: 'file', file, fileName: file.name, fileType: file.type, fileSize: file.size });
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: user?.username || 'Me', file: { name: file.name, size: file.size, type: file.type, blob: file }, timestamp: Date.now(), isSelf: true }].slice(-50));
    };

    const sendAssetRequest = async () => {
        if (!requestData.name.trim() || !user) return;
        try {
            const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ content: `📢 ASSET REQUEST: I need "${requestData.name}"`, type: 'request', metadata: { assetType: requestData.type } })
            });
            if (res.ok) {
                toast.success('Request sent');
                setRequestData({ name: '', type: '3D Asset' });
                setIsRequesting(false);
            }
        } catch { toast.error('Request failed'); }
    };

    if (!mounted) return null;

    return (
        <div className="flex w-full h-full bg-slate-950/20 backdrop-blur-md rounded-tl-3xl overflow-hidden border border-white/5 shadow-2xl">
            {/* Left Column - Users & Contacts */}
            <div className="w-80 shrink-0 border-r border-white/5 bg-black/40 flex flex-col">
                <div className="p-6 border-b border-white/5 bg-black/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-black text-xl border border-accent/10">
                                {user?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                                <p className="text-lg font-black text-white leading-tight uppercase tracking-tight">{user?.username}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center gap-1.5 uppercase font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Online Mode
                                </p>
                            </div>
                        </div>
                        <button onClick={logout} className="p-2.5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-400 transition-all">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-3 flex items-center justify-between">
                            <span>ONLINE MEMBERS</span>
                            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md text-[9px]">{roomUsers.length}</span>
                        </h3>
                        <div className="space-y-1.5">
                            {(() => {
                                const displayed = [...roomUsers];
                                if (activeConvId !== DEFAULT_CONV_ID) {
                                    const conv = conversations.find(c => c.id === activeConvId);
                                    conv?.members?.forEach((m: any) => {
                                        if (m.user && !displayed.find(u => u.id === m.user_id)) {
                                            displayed.push({ id: m.user_id, username: m.user.username, peer_id: m.user.peer_id, isOffline: true });
                                        }
                                    });
                                }
                                if (user && !displayed.find(u => u.id === user.id)) displayed.push(user);
                                return displayed.map(u => (
                                    <div key={u.id} className="group/user flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/5 transition-all">
                                        <button onClick={() => startDirectMessage(u)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, visible: true, targetUser: u }); }}
                                            className={`flex-1 flex items-center gap-3.5 text-left ${u.id === user?.id ? 'opacity-50' : 'cursor-pointer'} ${u.isOffline ? 'opacity-40 grayscale' : ''}`}>
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-sm font-black text-slate-400 border border-white/5 shadow-inner">
                                                    {u.username?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${u.isOffline ? 'bg-slate-700' : 'bg-green-500'}`} />
                                            </div>
                                            <div>
                                                <p className="text-base font-black text-slate-200 group-hover/user:text-white transition-colors tracking-tight">
                                                    {activeConvCreatorId === u.id ? '@' : ''}{u.username}
                                                </p>
                                                {u.id === user?.id && <p className="text-[9px] text-accent font-black uppercase tracking-widest mt-0.5">{t('chat.you')}</p>}
                                            </div>
                                        </button>
                                        {activeConvId !== DEFAULT_CONV_ID && activeConvCreatorId === user?.id && u.id !== user?.id && (
                                            <button onClick={() => kickUser(u.id)} className="opacity-0 group-hover/user:opacity-100 p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-xl transition-all"><X className="w-4 h-4" /></button>
                                        )}
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-white/5">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-3">Contacts</h3>
                        <div className="px-3">
                            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-1.5 focus-within:border-accent/40 transition-all">
                                <input value={friendId} onChange={(e) => setFriendId(e.target.value)} placeholder="Enter peer ID..." className="flex-1 bg-transparent border-none text-[11px] text-white px-3 outline-none" />
                                <button onClick={addContact} disabled={!friendId.trim()} className="p-2 px-4 bg-accent text-slate-950 rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-all text-[10px] font-black uppercase">ADD</button>
                            </div>
                        </div>
                        <div className="space-y-1.5 px-1.5">
                            {contacts.map(c => (
                                <button key={c.id} onClick={() => startDirectMessage(c.contact)} className="w-full flex items-center gap-4 p-2.5 rounded-2xl hover:bg-white/5 transition-all text-left group">
                                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent text-xs font-black">{c.contact?.username?.[0]?.toUpperCase() || '?'}</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-slate-300 group-hover:text-white transition-colors truncate uppercase">{c.contact?.username}</p>
                                        <p className="text-[9px] text-slate-600 font-mono truncate tracking-tight">{c.contact?.peer_id}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Center Column - Messages & Input */}
            <div className="flex-1 flex flex-col bg-transparent relative min-w-0 border-r border-white/5 overflow-hidden">
                <div className="h-20 shrink-0 border-b border-white/5 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center text-accent shadow-2xl shadow-accent/10">
                            {activeConvId === DEFAULT_CONV_ID ? <Globe className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight uppercase">{activeConvName}</h2>
                            <div className="flex items-center gap-4 mt-0.5">
                                <p className="text-[10px] text-slate-500 font-bold flex items-center gap-2 uppercase tracking-widest">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    {activeConvId === DEFAULT_CONV_ID ? 'Global Sync' : 'Secured Session'}
                                </p>
                                {isVoiceActive && (
                                    <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                        <div className="flex gap-1">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="w-0.5 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                                            ))}
                                        </div>
                                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">VOICE LIVE</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {isVoiceActive ? (
                            <>
                                <button
                                    onClick={toggleMute}
                                    className={`p-3 rounded-2xl transition-all ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}
                                    title={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={endVoiceChat}
                                    className="px-6 py-3 bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
                                >
                                    <PhoneOff className="w-4 h-4" />
                                    Leave
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => startVoiceChat()}
                                className="px-6 py-3 bg-accent text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-accent-hover transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
                            >
                                <Volume2 className="w-4 h-4" />
                                Start Voice
                            </button>
                        )}
                        <button onClick={() => setIsInviteModalOpen(true)} className="p-3 bg-white/5 border border-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <UserPlus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar font-fixedsys">
                    {activeConvId !== DEFAULT_CONV_ID && (
                        <div className="max-w-4xl mx-auto w-full mb-10 text-center">
                            <div className="bg-accent/5 border border-accent/20 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                                <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">#{activeConvName}</h1>
                                <p className="text-sm text-slate-400 font-medium mb-6">{activeConvTopic || 'No topic set for this ShareChannel'}</p>
                                <div className="flex items-center justify-center gap-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    <span>OWNER: {activeConvCreatorName}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                    <span>CREATED: {activeConvCreatedAt ? new Date(activeConvCreatedAt).toLocaleDateString() : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} className="flex flex-col items-start max-w-4xl mx-auto w-full group">
                            <div className="flex items-baseline gap-3 w-full px-6 py-2 hover:bg-white/5 rounded-2xl transition-all">
                                <span className="text-[10px] text-slate-600 font-mono shrink-0">[{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>
                                <span className={`text-sm font-black shrink-0 ${msg.isSelf ? 'text-accent' : 'text-slate-200'}`}>&lt;{msg.sender}&gt;</span>
                                <div className="flex-1 min-w-0">
                                    {msg.type === 'system' ? (
                                        <div className="bg-slate-900/60 border border-white/5 rounded-xl px-4 py-2 text-xs font-black tracking-tight text-slate-400 italic">
                                            {msg.text}
                                        </div>
                                    ) : msg.type === 'secure_transfer' ? (
                                        <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-2xl px-4 py-3 flex items-center gap-4 max-w-sm">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                <Lock className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-emerald-300 uppercase tracking-widest">🔐 Encrypted Pack</p>
                                                <p className="text-sm text-slate-300 font-bold truncate">{msg.metadata?.assetName || 'Asset Pack'}</p>
                                                <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                                                    {msg.metadata?.sizeBytes ? `${(msg.metadata.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ''}
                                                </p>
                                            </div>
                                            {!msg.isSelf && msg.metadata?.recipientPublicKey === keyPair?.publicKey && (
                                                <button
                                                    onClick={() => receiveEncryptedAssets(msg.metadata)}
                                                    disabled={isReceiving}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                                                >
                                                    {isReceiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                                    DECRYPT
                                                </button>
                                            )}
                                            {msg.isSelf && (
                                                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-slate-100 leading-relaxed font-medium break-words">{msg.text}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />

                </div>

                <div className="p-8 bg-black/20 border-t border-white/5">
                    <div className="max-w-4xl mx-auto w-full space-y-3">
                        {/* Progress bar for active transfer */}
                        {(isSending || isReceiving) && (
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-4 bg-slate-900/80 p-3 rounded-3xl border border-white/10 shadow-2xl focus-within:border-accent/40 transition-all">
                            <button onClick={handleFileUpload as any} className="p-4 bg-white/5 hover:bg-accent/20 text-slate-400 hover:text-accent rounded-2xl transition-all"><Upload className="w-6 h-6" /></button>
                            {/* Secure send button — visible only in direct channels */}
                            {conversations.find(c => c.id === activeConvId)?.type === 'direct' && (
                                <button
                                    title="Send Encrypted Asset Pack"
                                    onClick={() => setSendEncryptedModal({ open: true, assetIds: [], assetName: '' })}
                                    className="p-4 bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-500 rounded-2xl transition-all"
                                >
                                    <Lock className="w-6 h-6" />
                                </button>
                            )}
                            <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Transmit message..." className="flex-1 bg-transparent border-none text-base text-white placeholder:text-slate-700 outline-none font-fixedsys" />
                            <button onClick={sendMessage} disabled={!inputValue.trim()} className="p-4 bg-accent text-slate-950 rounded-2xl hover:bg-accent-hover transition-all disabled:opacity-20 shadow-xl shadow-accent/10"><Send className="w-6 h-6" /></button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Right Column - ShareChannels */}
            <div className="w-80 shrink-0 bg-black/60 flex flex-col border-l border-white/5">
                <div className="p-8 border-b border-white/5 bg-black/20">
                    <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.3em] mb-6">Discovery Center</h3>
                    <button onClick={() => setIsCreateModalOpen(true)} className="w-full flex items-center justify-center gap-3 p-5 bg-accent/10 hover:bg-accent text-accent hover:text-slate-950 border border-accent/20 rounded-2xl transition-all font-black text-xs uppercase tracking-widest shadow-2xl shadow-accent/5 group">
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        Create Share Channel
                    </button>
                    <div className="mt-8 p-5 bg-black/40 border border-white/5 rounded-2xl">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 block">Personal Transmit ID</label>
                        <div className="flex items-center justify-between gap-3">
                            <code className="text-xs font-mono font-bold text-slate-400 break-all leading-tight">{user?.peer_id}</code>
                            <button onClick={() => { navigator.clipboard.writeText(user?.peer_id || ''); toast.success('ID Copied'); }} className="p-2 bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white rounded-lg transition-all"><Copy className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Active Channels</h3>
                        <div className="space-y-2">
                            <button onClick={() => { setActiveConvId(DEFAULT_CONV_ID); setActiveConvName('General Chat'); }}
                                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${activeConvId === DEFAULT_CONV_ID ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-black/20 border-transparent hover:bg-white/5 hover:border-white/5'}`}>
                                <div className="w-10 h-10 rounded-xl bg-slate-900/80 flex items-center justify-center text-slate-500"><Globe className="w-5 h-5" /></div>
                                <div className="text-left"><p className="text-sm font-black uppercase tracking-tight">General</p><p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Public Lobby</p></div>
                            </button>
                            {conversations.filter(c => c.id !== DEFAULT_CONV_ID).map(conv => (
                                <div key={conv.id} onClick={() => { setActiveConvId(conv.id); setActiveConvName(conv.name); }}
                                    className={`group/conv w-full flex items-center justify-between p-4 rounded-2xl transition-all border cursor-pointer ${activeConvId === conv.id ? 'bg-accent/10 border-accent/20 shadow-lg' : 'bg-black/20 border-transparent hover:bg-white/5 hover:border-white/5'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900/80 flex items-center justify-center text-slate-500"><Users className="w-5 h-5" /></div>
                                        <div className="text-left">
                                            <p className={`text-sm font-black uppercase tracking-tight ${activeConvId === conv.id ? 'text-accent' : 'text-slate-300'}`}>#{conv.name}</p>
                                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">ShareChannel</p>
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Leave?')) leaveChannel(conv.id, conv.name); }} className="opacity-0 group-hover/conv:opacity-100 p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-lg transition-all"><LogOut className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}

            {/* 🔐 Send Encrypted Asset Modal */}
            {sendEncryptedModal?.open && (() => {
                const activeConv = conversations.find(c => c.id === activeConvId);
                const recipientMember = activeConv?.members?.find((m: any) => m.user_id !== user?.id);
                const recipientContact = contacts.find((c: any) => c.contact?.id === recipientMember?.user_id)?.contact;
                const recipientPubKey = recipientContact?.public_key || '';

                return (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
                        <div className="bg-[#0b0e14] border border-emerald-500/20 rounded-[32px] p-10 w-full max-w-lg shadow-2xl space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                                    <Lock className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Send Encrypted Pack</h2>
                                    <p className="text-xs text-slate-500 font-medium">XSalsa20-Poly1305 · X25519-ECDH · Zero-Knowledge</p>
                                </div>
                            </div>

                            {recipientPubKey ? (
                                <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-start gap-3">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-emerald-300 font-bold">Recipient has encryption key</p>
                                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 break-all">{recipientPubKey.slice(0, 32)}...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-red-950/40 border border-red-500/20 rounded-2xl px-4 py-3">
                                    <p className="text-xs text-red-400 font-bold">⚠ Recipient has no public key — encrypted send unavailable</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Asset Name (label)</label>
                                <input
                                    value={sendEncryptedModal.assetName}
                                    onChange={(e) => setSendEncryptedModal(prev => prev ? { ...prev, assetName: e.target.value } : null)}
                                    placeholder="e.g. Stone Wall Pack v2"
                                    className="w-full bg-black/60 border border-white/5 rounded-2xl px-6 py-4 text-base text-white focus:border-emerald-500/50 outline-none font-bold placeholder:text-slate-800"
                                />
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Asset IDs (comma-separated)</label>
                                <textarea
                                    value={sendEncryptedModal.assetIds.join(', ')}
                                    onChange={(e) => setSendEncryptedModal(prev => prev ? {
                                        ...prev,
                                        assetIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                    } : null)}
                                    placeholder="surface_stone_001, mesh_rock_004..."
                                    rows={3}
                                    className="w-full bg-black/60 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500/50 outline-none font-mono placeholder:text-slate-800 resize-none"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setSendEncryptedModal(null)}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-black text-xs uppercase hover:bg-white/10 transition-all tracking-widest"
                                >
                                    Abort
                                </button>
                                <button
                                    disabled={isSending || !recipientPubKey || sendEncryptedModal.assetIds.length === 0 || !sendEncryptedModal.assetName}
                                    onClick={async () => {
                                        await sendEncryptedAssets(
                                            [],
                                            sendEncryptedModal.assetIds,
                                            sendEncryptedModal.assetName,
                                            recipientPubKey,
                                            activeConvId
                                        );
                                        setSendEncryptedModal(null);
                                    }}
                                    className="flex-[2] py-4 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase hover:bg-emerald-500 transition-all disabled:opacity-30 tracking-widest shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2"
                                >
                                    {isSending
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> ENCRYPTING... {progress}%</>
                                        : <><Lock className="w-4 h-4" /> ENCRYPT & SEND</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[101] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#0b0e14] border border-white/10 rounded-[32px] p-10 w-full max-w-lg shadow-2xl space-y-8 animate-in zoom-in-95">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Forge Channel</h2>
                            <p className="text-sm text-slate-500 font-medium">Create a private share space for your collaborative 3D works.</p>
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Channel Signature</label>
                            <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="e.g. MEGA-PROJECT-ALPHA" className="w-full bg-black/60 border border-white/5 rounded-2xl px-6 py-4 text-base text-white focus:border-accent outline-none font-bold placeholder:text-slate-800" />
                        </div>
                        <div className="flex gap-4 pt-4">
                            <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-black text-xs uppercase hover:bg-white/10 transition-all tracking-widest">Abort</button>
                            <button onClick={createChannel} disabled={loading || !newChannelName.trim()} className="flex-1 py-4 rounded-2xl bg-accent text-slate-950 font-black text-xs uppercase hover:bg-accent-hover transition-all disabled:opacity-20 tracking-widest shadow-xl shadow-accent/10">Initialize</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div className="fixed z-[200] bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl py-2 shadow-2xl min-w-[200px] animate-in fade-in zoom-in-95 duration-100" style={{ left: contextMenu.x, top: contextMenu.y }}>
                    <div className="px-4 py-3 border-b border-white/5 mb-2"><p className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">{contextMenu.targetUser?.username}</p></div>
                    <button onClick={() => startDirectMessage(contextMenu.targetUser)} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-slate-300 hover:bg-accent/10 hover:text-accent transition-all text-left uppercase tracking-tight"><MessageSquare className="w-4 h-4" /> Direct Link</button>
                    {activeConvId !== DEFAULT_CONV_ID && activeConvCreatorId === user?.id && (
                        <button onClick={() => kickUser(contextMenu.targetUser?.id)} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-red-500 hover:bg-red-500/10 transition-all text-left uppercase tracking-tight"><X className="w-4 h-4" /> Terminate Access</button>
                    )}
                </div>
            )}
            {/* Voice Chat Audio Elements */}
            <div className="hidden">
                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                    <audio
                        key={peerId}
                        autoPlay
                        ref={el => {
                            if (el && el.srcObject !== stream) {
                                el.srcObject = stream;
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
