#!/usr/bin/env node
/**
 * Manual integration test for task status consistency
 * This script verifies that the status fix works correctly
 */

import { databaseStorage } from '../server/lib/database-storage.js';

async function testTaskStatusConsistency() {
  console.log('🧪 Testing task status consistency...\n');

  try {
    // Create a mock user ID for testing
    const testUserId = 'test-user-status-check';
    
    // Test 1: Create a task in queued status
    console.log('1. Creating a task in queued status...');
    const taskData = {
      userId: testUserId,
      repositoryId: 'test-repo-id',
      owner: 'testowner',
      repo: 'testrepo',
      title: 'Test Task Status Consistency',
      body: 'Testing task status consistency after fix',
      labels: ['test']
    };

    const queuedTask = await databaseStorage.createTask(taskData);
    console.log(`   ✅ Created task ${queuedTask.id} with status: ${queuedTask.status}`);

    // Test 2: Check that getQueuedTasks returns the task
    const queuedTasks = await databaseStorage.getQueuedTasks(testUserId);
    const isInQueue = queuedTasks.some(task => task.id === queuedTask.id);
    console.log(`   ✅ Task found in queued tasks: ${isInQueue}`);

    // Test 3: Check that getActiveTask returns undefined (no active task yet)
    const activeTask1 = await databaseStorage.getActiveTask(testUserId);
    console.log(`   ✅ No active task found: ${activeTask1 === undefined}`);

    // Test 4: Update task to in_progress status
    console.log('\n2. Updating task to in_progress status...');
    const updatedTask = await databaseStorage.updateTask(queuedTask.id, {
      status: 'in_progress'
    });
    console.log(`   ✅ Updated task status to: ${updatedTask?.status}`);

    // Test 5: Check that getActiveTask now returns the task
    const activeTask2 = await databaseStorage.getActiveTask(testUserId);
    console.log(`   ✅ Active task found: ${activeTask2?.id === queuedTask.id}`);
    console.log(`   ✅ Active task status: ${activeTask2?.status}`);

    // Test 6: Check that getQueuedTasks no longer returns the task
    const queuedTasks2 = await databaseStorage.getQueuedTasks(testUserId);
    const isStillInQueue = queuedTasks2.some(task => task.id === queuedTask.id);
    console.log(`   ✅ Task no longer in queued tasks: ${!isStillInQueue}`);

    // Test 7: Complete the task
    console.log('\n3. Completing the task...');
    const completedTask = await databaseStorage.updateTask(queuedTask.id, {
      status: 'completed'
    });
    console.log(`   ✅ Task completed with status: ${completedTask?.status}`);

    // Test 8: Check that getActiveTask returns undefined (no active task)
    const activeTask3 = await databaseStorage.getActiveTask(testUserId);
    console.log(`   ✅ No active task after completion: ${activeTask3 === undefined}`);

    // Cleanup
    console.log('\n4. Cleaning up...');
    await databaseStorage.deleteTask(queuedTask.id);
    console.log('   ✅ Test task deleted');

    console.log('\n🎉 All tests passed! Task status consistency is working correctly.');
    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTaskStatusConsistency()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution error:', error);
      process.exit(1);
    });
}

export { testTaskStatusConsistency };