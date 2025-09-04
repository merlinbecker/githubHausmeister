import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Eye, 
  Smartphone, 
  MessageCircle, 
  Image as ImageIcon, 
  Mic, 
  Settings, 
  Plus,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types for mentraOS integration
interface MentraGlass {
  id: string;
  glassId: string;
  glassName: string;
  deviceModel: string;
  isActive: boolean;
  lastSeen: string;
  createdAt: string;
}

interface VoiceCommand {
  id: string;
  originalText: string;
  commandType: string;
  executionStatus: 'pending' | 'executed' | 'failed';
  result?: any;
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
}

interface GlassNotification {
  id: string;
  notificationType: 'text' | 'image' | 'combined';
  title: string;
  message: string;
  imageUrl?: string;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: string;
  createdAt: string;
}

interface GlassStatus {
  glasses: MentraGlass[];
  totalNotifications: number;
  recentCommands: VoiceCommand[];
}

// API functions
const api = {
  async getGlassStatus(): Promise<GlassStatus> {
    const response = await fetch('/api/mentra/glasses');
    if (!response.ok) throw new Error('Failed to fetch glass status');
    return response.json();
  },

  async registerGlass(data: {
    glassId: string;
    glassName: string;
    deviceModel?: string;
    apiEndpoint?: string;
  }) {
    const response = await fetch('/api/mentra/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to register glass');
    return response.json();
  },

  async sendNotification(data: {
    glassId: string;
    notification: {
      type: 'text' | 'image' | 'combined';
      title: string;
      message: string;
      imageUrl?: string;
      imageData?: string;
    };
  }) {
    const response = await fetch('/api/mentra/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to send notification');
    return response.json();
  },

  async sendImageNotification(data: {
    glassId: string;
    title: string;
    message?: string;
    imageUrl?: string;
    imageData?: string;
  }) {
    const response = await fetch('/api/mentra/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to send image');
    return response.json();
  },

  async getVoiceCommands(): Promise<VoiceCommand[]> {
    const response = await fetch('/api/mentra/voice-commands');
    if (!response.ok) throw new Error('Failed to fetch voice commands');
    return response.json();
  },

  async getNotifications(): Promise<GlassNotification[]> {
    const response = await fetch('/api/mentra/notifications');
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  async deactivateGlass(glassId: string) {
    const response = await fetch(`/api/mentra/glasses/${glassId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to deactivate glass');
    return response.json();
  },
};

export function MentraOSTester() {
  const queryClient = useQueryClient();
  const [selectedGlass, setSelectedGlass] = useState<string>('');
  const [testResults, setTestResults] = useState<string[]>([]);

  // Queries
  const { data: glassStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['mentra-status'],
    queryFn: api.getGlassStatus,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: voiceCommands } = useQuery({
    queryKey: ['mentra-voice-commands'],
    queryFn: api.getVoiceCommands,
    refetchInterval: 3000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['mentra-notifications'],
    queryFn: api.getNotifications,
    refetchInterval: 3000,
  });

  // Mutations
  const registerGlassMutation = useMutation({
    mutationFn: api.registerGlass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentra-status'] });
      addTestResult('✅ Glass successfully registered');
    },
    onError: (error) => {
      addTestResult(`❌ Registration failed: ${error.message}`);
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: api.sendNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentra-notifications'] });
      addTestResult('✅ Notification sent successfully');
    },
    onError: (error) => {
      addTestResult(`❌ Notification failed: ${error.message}`);
    },
  });

  const sendImageMutation = useMutation({
    mutationFn: api.sendImageNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentra-notifications'] });
      addTestResult('✅ Image sent successfully');
    },
    onError: (error) => {
      addTestResult(`❌ Image sending failed: ${error.message}`);
    },
  });

  const deactivateGlassMutation = useMutation({
    mutationFn: api.deactivateGlass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentra-status'] });
      addTestResult('✅ Glass deactivated');
    },
    onError: (error) => {
      addTestResult(`❌ Deactivation failed: ${error.message}`);
    },
  });

  const addTestResult = (message: string) => {
    setTestResults(prev => [
      `${new Date().toLocaleTimeString()}: ${message}`,
      ...prev.slice(0, 49) // Keep last 50 entries
    ]);
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'executed':
      case 'sent':
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (statusLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">mentraOS Integration Dashboard</h1>
          <p className="text-muted-foreground">
            Test and manage evenrealities G1 smartglasses integration
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {glassStatus?.glasses.filter(g => g.isActive).length || 0} Active Glasses
        </Badge>
      </div>

      <Tabs defaultValue="glasses" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="glasses" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Glasses
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Test
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Test Logs
          </TabsTrigger>
        </TabsList>

        {/* Glasses Management */}
        <TabsContent value="glasses" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Register New Glass
                </CardTitle>
                <CardDescription>
                  Register a new evenrealities G1 smartglass with your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <GlassRegistrationForm
                  onSubmit={(data) => registerGlassMutation.mutate(data)}
                  isLoading={registerGlassMutation.isPending}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registered Glasses</CardTitle>
                <CardDescription>
                  Manage your connected smartglasses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {glassStatus?.glasses.map((glass) => (
                      <GlassCard
                        key={glass.id}
                        glass={glass}
                        onDeactivate={() => deactivateGlassMutation.mutate(glass.glassId)}
                        isDeactivating={deactivateGlassMutation.isPending}
                      />
                    ))}
                    {(!glassStatus?.glasses || glassStatus.glasses.length === 0) && (
                      <p className="text-sm text-muted-foreground">
                        No glasses registered yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Send Notifications Test */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <NotificationTester
              glasses={glassStatus?.glasses || []}
              onSendNotification={(data) => sendNotificationMutation.mutate(data)}
              onSendImage={(data) => sendImageMutation.mutate(data)}
              isLoading={sendNotificationMutation.isPending || sendImageMutation.isPending}
            />
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Voice Commands History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {voiceCommands?.map((command) => (
                      <VoiceCommandCard key={command.id} command={command} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Sent Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {notifications?.map((notification) => (
                      <NotificationCard key={notification.id} notification={notification} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Test Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Test Logs
                </span>
                <Button variant="outline" size="sm" onClick={clearTestResults}>
                  Clear Logs
                </Button>
              </CardTitle>
              <CardDescription>
                Live test results and debugging information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 font-mono text-sm">
                  {testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded ${
                        result.includes('✅') 
                          ? 'bg-green-50 text-green-800' 
                          : result.includes('❌') 
                          ? 'bg-red-50 text-red-800'
                          : 'bg-blue-50 text-blue-800'
                      }`}
                    >
                      {result}
                    </div>
                  ))}
                  {testResults.length === 0 && (
                    <p className="text-muted-foreground">
                      No test results yet. Start testing to see logs here.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Sub-components

interface GlassRegistrationFormProps {
  onSubmit: (data: { glassId: string; glassName: string; deviceModel?: string; apiEndpoint?: string }) => void;
  isLoading: boolean;
}

function GlassRegistrationForm({ onSubmit, isLoading }: GlassRegistrationFormProps) {
  const [formData, setFormData] = useState({
    glassId: '',
    glassName: '',
    deviceModel: 'evenrealities G1',
    apiEndpoint: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.glassId && formData.glassName) {
      onSubmit(formData);
      setFormData({ glassId: '', glassName: '', deviceModel: 'evenrealities G1', apiEndpoint: '' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="glassId">Glass ID *</Label>
        <Input
          id="glassId"
          value={formData.glassId}
          onChange={(e) => setFormData({ ...formData, glassId: e.target.value })}
          placeholder="Enter glass identifier"
          required
        />
      </div>
      <div>
        <Label htmlFor="glassName">Display Name *</Label>
        <Input
          id="glassName"
          value={formData.glassName}
          onChange={(e) => setFormData({ ...formData, glassName: e.target.value })}
          placeholder="My Smartglasses"
          required
        />
      </div>
      <div>
        <Label htmlFor="deviceModel">Device Model</Label>
        <Input
          id="deviceModel"
          value={formData.deviceModel}
          onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
          placeholder="evenrealities G1"
        />
      </div>
      <div>
        <Label htmlFor="apiEndpoint">API Endpoint (Optional)</Label>
        <Input
          id="apiEndpoint"
          value={formData.apiEndpoint}
          onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
          placeholder="https://api.mentra.glass/..."
        />
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Registering...' : 'Register Glass'}
      </Button>
    </form>
  );
}

interface GlassCardProps {
  glass: MentraGlass;
  onDeactivate: () => void;
  isDeactivating: boolean;
}

function GlassCard({ glass, onDeactivate, isDeactivating }: GlassCardProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{glass.glassName}</h4>
          <Badge variant={glass.isActive ? 'default' : 'secondary'}>
            {glass.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {glass.deviceModel} • Last seen: {formatDate(glass.lastSeen)}
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          ID: {glass.glassId}
        </p>
      </div>
      {glass.isActive && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDeactivate}
          disabled={isDeactivating}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface NotificationTesterProps {
  glasses: MentraGlass[];
  onSendNotification: (data: any) => void;
  onSendImage: (data: any) => void;
  isLoading: boolean;
}

function NotificationTester({ glasses, onSendNotification, onSendImage, isLoading }: NotificationTesterProps) {
  const [selectedGlass, setSelectedGlass] = useState('');
  const [notificationForm, setNotificationForm] = useState({
    type: 'text' as 'text' | 'image',
    title: '',
    message: '',
    imageUrl: '',
  });

  const activeGlasses = glasses.filter(g => g.isActive);

  const handleSendNotification = () => {
    if (!selectedGlass || !notificationForm.title) return;

    if (notificationForm.type === 'text') {
      onSendNotification({
        glassId: selectedGlass,
        notification: {
          type: notificationForm.type,
          title: notificationForm.title,
          message: notificationForm.message,
        },
      });
    } else {
      onSendImage({
        glassId: selectedGlass,
        title: notificationForm.title,
        message: notificationForm.message,
        imageUrl: notificationForm.imageUrl,
      });
    }

    // Reset form
    setNotificationForm({ type: 'text', title: '', message: '', imageUrl: '' });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Test Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target Glass</Label>
            <Select value={selectedGlass} onValueChange={setSelectedGlass}>
              <SelectTrigger>
                <SelectValue placeholder="Select a glass" />
              </SelectTrigger>
              <SelectContent>
                {activeGlasses.map((glass) => (
                  <SelectItem key={glass.glassId} value={glass.glassId}>
                    {glass.glassName} ({glass.deviceModel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notification Type</Label>
            <Select
              value={notificationForm.type}
              onValueChange={(value: 'text' | 'image') =>
                setNotificationForm({ ...notificationForm, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Only</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={notificationForm.title}
              onChange={(e) =>
                setNotificationForm({ ...notificationForm, title: e.target.value })
              }
              placeholder="Notification title"
            />
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={notificationForm.message}
              onChange={(e) =>
                setNotificationForm({ ...notificationForm, message: e.target.value })
              }
              placeholder="Notification message"
              rows={3}
            />
          </div>

          {notificationForm.type === 'image' && (
            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                value={notificationForm.imageUrl}
                onChange={(e) =>
                  setNotificationForm({ ...notificationForm, imageUrl: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
              />
            </div>
          )}

          <Button
            onClick={handleSendNotification}
            disabled={!selectedGlass || !notificationForm.title || isLoading}
            className="w-full"
          >
            {isLoading ? 'Sending...' : 'Send Test Notification'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Test Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            onClick={() => {
              if (selectedGlass) {
                onSendNotification({
                  glassId: selectedGlass,
                  notification: {
                    type: 'text',
                    title: 'GitHub Hausmeister',
                    message: 'Test notification from GitHub Hausmeister',
                  },
                });
              }
            }}
            disabled={!selectedGlass || isLoading}
            className="w-full"
          >
            Send Basic Test
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (selectedGlass) {
                onSendNotification({
                  glassId: selectedGlass,
                  notification: {
                    type: 'text',
                    title: '✅ Task Completed',
                    message: 'Security update task completed successfully',
                  },
                });
              }
            }}
            disabled={!selectedGlass || isLoading}
            className="w-full"
          >
            Simulate Task Completion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function VoiceCommandCard({ command }: { command: VoiceCommand }) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{command.commandType}</Badge>
        <div className="flex items-center gap-1">
          {getStatusIcon(command.executionStatus)}
          <span className="text-xs text-muted-foreground">
            {command.executionStatus}
          </span>
        </div>
      </div>
      <p className="text-sm font-medium">"{command.originalText}"</p>
      {command.result && (
        <p className="text-xs text-muted-foreground">
          Result: {command.result.message}
        </p>
      )}
      {command.errorMessage && (
        <p className="text-xs text-red-600">Error: {command.errorMessage}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {formatDate(command.createdAt)}
      </p>
    </div>
  );
}

function NotificationCard({ notification }: { notification: GlassNotification }) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {notification.notificationType === 'image' ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          <Badge variant="outline">{notification.notificationType}</Badge>
        </div>
        <div className="flex items-center gap-1">
          {getStatusIcon(notification.deliveryStatus)}
          <span className="text-xs text-muted-foreground">
            {notification.deliveryStatus}
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-muted-foreground">{notification.message}</p>
        )}
        {notification.imageUrl && (
          <p className="text-xs text-blue-600">Image: {notification.imageUrl}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {formatDate(notification.createdAt)}
        {notification.sentAt && ` • Sent: ${formatDate(notification.sentAt)}`}
      </p>
    </div>
  );
}

// Helper function (moved here as it's used in multiple components)
function getStatusIcon(status: string) {
  switch (status) {
    case 'executed':
    case 'sent':
    case 'delivered':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}