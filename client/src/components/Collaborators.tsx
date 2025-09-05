import { useQuery } from '@tanstack/react-query';
import { Users, Shield, Settings, Eye } from 'lucide-react';
import { getRepositoryCollaborators, type UserRepository } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface CollaboratorsProps {
  repository: UserRepository;
}

export default function Collaborators({ repository }: CollaboratorsProps) {
  const { 
    data: collaborators, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['repository-collaborators', repository.owner, repository.repo],
    queryFn: () => getRepositoryCollaborators(repository.owner, repository.repo),
    staleTime: 5 * 60 * 1000, // 5 minutes - collaborators don't change often
  });

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'maintain':
        return <Settings className="h-4 w-4 text-orange-500" />;
      case 'write':
      case 'push':
        return <Settings className="h-4 w-4 text-blue-500" />;
      default:
        return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'destructive' as const;
      case 'maintain':
        return 'default' as const;
      case 'write':
      case 'push':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Repository Collaborators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-github-accent-emphasis"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Repository Collaborators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-github-text-secondary">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Failed to load collaborators</p>
            <p className="text-sm">You may not have permission to view collaborators</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!collaborators || collaborators.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Repository Collaborators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-github-text-secondary">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No collaborators found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort collaborators by role (admin first, then by login)
  const sortedCollaborators = [...collaborators].sort((a, b) => {
    const roleOrder = { admin: 0, maintain: 1, write: 2, push: 2, read: 3, pull: 3 };
    const aOrder = roleOrder[a.role_name.toLowerCase() as keyof typeof roleOrder] ?? 999;
    const bOrder = roleOrder[b.role_name.toLowerCase() as keyof typeof roleOrder] ?? 999;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.login.localeCompare(b.login);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Repository Collaborators ({collaborators.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedCollaborators.map((collaborator) => (
            <div 
              key={collaborator.id} 
              className="flex items-center justify-between p-3 rounded-lg bg-github-canvas-subtle border border-github-border-default hover:bg-github-canvas-default transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={collaborator.avatar_url} 
                    alt={collaborator.login}
                  />
                  <AvatarFallback>
                    {collaborator.login[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://github.com/${collaborator.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline text-github-text"
                    >
                      {collaborator.login}
                    </a>
                    {collaborator.login.toLowerCase().includes('copilot') && (
                      <Badge variant="secondary" className="text-xs">
                        🤖 Copilot
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-github-text-secondary mt-1">
                    {getRoleIcon(collaborator.role_name)}
                    <Badge variant={getRoleBadgeVariant(collaborator.role_name)}>
                      {collaborator.role_name}
                    </Badge>
                    {collaborator.permissions.admin && (
                      <span className="text-xs">Admin</span>
                    )}
                    {collaborator.permissions.push && !collaborator.permissions.admin && (
                      <span className="text-xs">Write</span>
                    )}
                    {collaborator.permissions.pull && !collaborator.permissions.push && (
                      <span className="text-xs">Read</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-right text-xs text-github-text-secondary">
                <div className="flex flex-col gap-1">
                  {collaborator.permissions.admin && (
                    <span className="text-red-600">Full access</span>
                  )}
                  {collaborator.permissions.push && !collaborator.permissions.admin && (
                    <span className="text-blue-600">Can push</span>
                  )}
                  {!collaborator.permissions.push && (
                    <span className="text-gray-600">Read only</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-github-canvas-subtle border border-github-border-default rounded-lg">
          <p className="text-sm text-github-text-secondary">
            <strong>Note:</strong> Only users with write access or higher can be assigned to issues.
            Copilot agents may appear in this list when they are actively working on repository issues.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}