// Socket connection status
export enum SocketStatusEnum {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
}

// Socket event names
export enum SocketEventEnum {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECT_ERROR = 'connect_error',
  RECONNECT = 'reconnect',
  RECONNECT_ATTEMPT = 'reconnect_attempt',
  RECONNECT_ERROR = 'reconnect_error',
  RECONNECT_FAILED = 'reconnect_failed',

  // Message events
  MESSAGE_SEND = 'message:send',
  MESSAGE_RECEIVE = 'message',
  MESSAGE_DELIVERED = 'message:delivered',
  MESSAGE_READ = 'message:read',
  MESSAGE_DELETE = 'message:delete',
  MESSAGE_UPDATE = 'message:update',

  // Typing events
  TYPING = 'typing',
  TYPING_START = 'typing:start',
  TYPING_STOP = 'typing:stop',

  // Room/Channel events
  ROOM_JOIN = 'room:join',
  ROOM_LEAVE = 'room:leave',
  ROOM_CREATED = 'room:created',
  ROOM_UPDATED = 'room:updated',
  ROOM_DELETED = 'room:deleted',

  // User events
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USER_JOINED = 'user:joined',
  USER_LEFT = 'user:left',

  // File upload events
  FILE_UPLOAD_START = 'file:upload:start',
  FILE_UPLOAD_PROGRESS = 'file:upload:progress',
  FILE_UPLOAD_COMPLETE = 'file:upload:complete',
  FILE_UPLOAD_ERROR = 'file:upload:error',

  // Voice message events
  VOICE_UPLOAD_START = 'voice:upload:start',
  VOICE_UPLOAD_COMPLETE = 'voice:upload:complete',
  VOICE_UPLOAD_ERROR = 'voice:upload:error',

  // Friendship events
  FRIEND_REQUEST_RECEIVED = 'friend_request_received',
  FRIEND_REQUEST_ACCEPTED = 'friend_request_accepted',
  FRIEND_REQUEST_DECLINED = 'friend_request_declined',

  // Error events
  ERROR = 'error',
}
