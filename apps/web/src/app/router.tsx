import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './root-layout';
import { ChatPage } from '../features/chat/chat-page';
import { SummaryPage } from '../features/summary/summary-page';
import { TranscriptPage } from '../features/transcript/transcript-page';
import { VideoDetailPage } from '../features/videos/video-detail-page';
import { UploadPage } from '../features/videos/upload-page';
import { VideosPage } from '../features/videos/videos-page';
import { SettingsPage } from '../features/settings/settings-page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <VideosPage /> },
      { path: 'videos', element: <VideosPage /> },
      { path: 'videos/new', element: <UploadPage /> },
      { path: 'videos/:id', element: <VideoDetailPage /> },
      { path: 'videos/:id/transcript', element: <TranscriptPage /> },
      { path: 'videos/:id/summary', element: <SummaryPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'chat/video/:id', element: <ChatPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  }
]);
