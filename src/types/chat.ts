export interface User {
    id: string;
    username: string;
    email: string;
    avatar_url?: string | null;
    status: string;
    last_seen: Date;
    created_at: Date;
    updated_at: Date;
}

export interface Conversation {
    id: string;
    type: 'channel' | 'direct';
    name?: string | null;
    description?: string | null;
    avatar_url?: string | null;
    created_by?: string | null;
    is_private: boolean;
    is_archived: boolean;
    created_at: Date;
    updated_at: Date;
    members?: ConversationMember[];
    messages?: Message[];
}

export interface ConversationMember {
    id: string;
    conversation_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: Date;
    last_read_message_id?: string | null;
    is_muted: boolean;
    muted_until?: Date | null;
    user?: User;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id?: string | null;
    type: 'text' | 'file' | 'image' | 'system' | 'voice' | 'asset_request';
    content: string;
    metadata?: any;
    reply_to?: string | null;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    sender?: User;
    attachments?: Attachment[];
}

export interface Attachment {
    id: string;
    message_id?: string | null;
    file_name: string;
    file_size: number;
    mime_type: string;
    storage_path: string;
    thumbnail_path?: string | null;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
    uploaded_by?: string | null;
    created_at: Date;
}

export interface AssetRequest {
    id: string;
    message_id: string;
    requester_id: string;
    conversation_id: string;
    asset_code: string;
    asset_name?: string | null;
    description?: string | null;
    status: 'pending' | 'fulfilled' | 'cancelled';
    fulfilled_by?: string | null;
    fulfilled_path?: string | null;
    fulfilled_at?: Date | null;
    created_at: Date;
}
