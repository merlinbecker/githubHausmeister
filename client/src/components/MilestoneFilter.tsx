import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Target } from 'lucide-react';
import { getRepositoryMilestones, type Milestone, type UserRepository } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MilestoneFilterProps {
  repository: UserRepository;
  selectedMilestone: string | null;
  onMilestoneChange: (milestone: string | null) => void;
}

export default function MilestoneFilter({
  repository,
  selectedMilestone,
  onMilestoneChange,
}: MilestoneFilterProps) {
  const { data: milestones, isLoading } = useQuery({
    queryKey: ['repository-milestones', repository.owner, repository.repo],
    queryFn: () => getRepositoryMilestones(repository.owner, repository.repo),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const getSelectedMilestoneTitle = () => {
    if (!selectedMilestone || !milestones) return 'All Milestones';
    const milestone = milestones.find(m => m.title === selectedMilestone);
    return milestone ? milestone.title : 'All Milestones';
  };

  const getMilestoneStatusColor = (milestone: Milestone) => {
    if (milestone.state === 'closed') return 'bg-purple-100 text-purple-800';
    if (milestone.due_on && new Date(milestone.due_on) < new Date()) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-green-100 text-green-800';
  };

  const formatDueDate = (dueOn: string | undefined) => {
    if (!dueOn) return null;
    const date = new Date(dueOn);
    const isOverdue = date < new Date();
    return {
      text: date.toLocaleDateString(),
      isOverdue,
    };
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="text-sm">
          <Target className="h-4 w-4 mr-2" />
          {getSelectedMilestoneTitle()}
          {milestones && milestones.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {milestones.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Filter by Milestone
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => onMilestoneChange(null)}>
          <div className="flex items-center justify-between w-full">
            <span>All Milestones</span>
            {!selectedMilestone && (
              <Badge variant="default" className="text-xs">
                Selected
              </Badge>
            )}
          </div>
        </DropdownMenuItem>
        
        {isLoading && (
          <DropdownMenuItem disabled>
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              Loading milestones...
            </div>
          </DropdownMenuItem>
        )}
        
        {milestones && milestones.length === 0 && (
          <DropdownMenuItem disabled>
            <span className="text-gray-500">No milestones found</span>
          </DropdownMenuItem>
        )}
        
        {milestones && milestones.map((milestone) => {
          const dueDate = formatDueDate(milestone.due_on);
          const isSelected = selectedMilestone === milestone.title;
          
          return (
            <DropdownMenuItem
              key={milestone.id}
              onClick={() => onMilestoneChange(milestone.title)}
              className="flex-col items-start p-3"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${getMilestoneStatusColor(milestone)}`}
                  >
                    {milestone.state}
                  </Badge>
                  <span className="font-medium">{milestone.title}</span>
                </div>
                {isSelected && (
                  <Badge variant="default" className="text-xs">
                    Selected
                  </Badge>
                )}
              </div>
              
              {milestone.description && (
                <p className="text-xs text-gray-600 mt-1 max-w-full truncate">
                  {milestone.description}
                </p>
              )}
              
              <div className="flex items-center justify-between w-full mt-2 text-xs text-gray-500">
                <span>
                  {milestone.open_issues} open, {milestone.closed_issues} closed
                </span>
                {dueDate && (
                  <div className={`flex items-center gap-1 ${dueDate.isOverdue ? 'text-red-600' : ''}`}>
                    <Calendar className="h-3 w-3" />
                    {dueDate.text}
                    {dueDate.isOverdue && ' (overdue)'}
                  </div>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}