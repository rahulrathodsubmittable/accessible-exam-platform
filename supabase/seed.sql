-- ============================================================================
-- Demo data. Safe to run more than once.
-- Run AFTER supabase/migrations/20260928000000_initial_schema.sql.
--
-- Demo Candidate IDs (each can take the exam once; reset from the Teacher portal):
--   EXM-2026-A7K92  Aarav Sharma
--   EXM-2026-B4P81  Priya Patel
--   EXM-2026-K9X32  Rohan Verma
-- ============================================================================

insert into public.exams (
    id, title, subject, description, duration_minutes,
    scheduled_start, scheduled_end, is_published,
    max_question_explanations, allow_ai_explanations_in_exam
) values (
    '00000000-0000-4000-8000-00000000e001',
    'Data Structures & Algorithms Formal Assessment',
    'Computer Science',
    'Formal assessment covering trees, queues, stacks and time complexity.',
    30,
    now() - interval '1 hour',
    now() + interval '60 days',
    true,
    3,
    true
) on conflict (id) do nothing;

insert into public.candidates (id, candidate_code, full_name, email, assigned_exam_id) values
    ('00000000-0000-4000-8000-00000000c001', 'EXM-2026-A7K92', 'Aarav Sharma', 'aarav@example.com', '00000000-0000-4000-8000-00000000e001'),
    ('00000000-0000-4000-8000-00000000c002', 'EXM-2026-B4P81', 'Priya Patel',  'priya@example.com', '00000000-0000-4000-8000-00000000e001'),
    ('00000000-0000-4000-8000-00000000c003', 'EXM-2026-K9X32', 'Rohan Verma',  'rohan@example.com', '00000000-0000-4000-8000-00000000e001')
on conflict (id) do nothing;

insert into public.questions (
    id, exam_id, question_text, options, correct_option_index, explanation,
    visual_description, has_visual_content, difficulty, topic, marks, order_index
) values
(
    '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000e001',
    'What is the average time complexity for searching an element in a balanced Binary Search Tree?',
    '["O(1)", "O(n)", "O(log n)", "O(n squared)"]', 2,
    'In a balanced binary search tree each comparison discards half of the remaining nodes, so a search takes logarithmic time: O(log n).',
    'Diagram of a binary search tree: the root node 50 has a left child 30 and a right child 70. Node 30 has children 20 and 40; node 70 has children 60 and 80. Both sides are the same height.',
    true, 'medium', 'Binary Search Trees', 2, 1
),
(
    '00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000e001',
    'Which data structure follows the First-In, First-Out (FIFO) principle?',
    '["Stack", "Queue", "Array", "Tree"]', 1,
    'A queue adds elements at the rear and removes them from the front, so the first element added is the first removed.',
    'Diagram of a queue drawn as a horizontal tube: items enter on the right (rear) and leave on the left (front).',
    true, 'easy', 'Linear Data Structures', 1, 2
),
(
    '00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000e001',
    'Which operation removes the most recently added element from a stack?',
    '["Enqueue", "Pop", "Peek", "Push"]', 1,
    'Pop removes and returns the top element of a stack, which is always the most recently pushed element.',
    null, false, 'easy', 'Linear Data Structures', 1, 3
),
(
    '00000000-0000-4000-8000-00000000a004', '00000000-0000-4000-8000-00000000e001',
    'What is the worst-case time complexity of inserting into an unsorted singly linked list at the head?',
    '["O(1)", "O(log n)", "O(n)", "O(n log n)"]', 0,
    'Inserting at the head only updates the new node''s next pointer and the head pointer, which takes constant time regardless of list length.',
    null, false, 'medium', 'Linked Lists', 1, 4
),
(
    '00000000-0000-4000-8000-00000000a005', '00000000-0000-4000-8000-00000000e001',
    'Which traversal of a binary search tree visits the keys in ascending sorted order?',
    '["Pre-order", "Post-order", "In-order", "Level-order"]', 2,
    'In-order traversal visits the left subtree, then the node, then the right subtree. In a BST, that produces keys in ascending order.',
    null, false, 'medium', 'Binary Search Trees', 2, 5
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- To give a Supabase Auth user access to the Teacher portal:
--   1. Supabase dashboard → Authentication → Users → Add user (email + password).
--   2. Run (replace the email):
--
--   insert into public.teachers (user_id, full_name)
--   select id, 'Teacher Name' from auth.users where email = 'teacher@example.com'
--   on conflict do nothing;
-- ---------------------------------------------------------------------------
