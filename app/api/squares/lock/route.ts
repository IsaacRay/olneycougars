import { NextResponse } from 'next/server';
import { getUser } from '../../../lib/simpleAuth';
import { createClient } from '../../../utils/supabase/server';
import { sendSquaresNotification } from '../../../lib/twilio';

// Fisher-Yates shuffle to generate random permutation of 0-9
function generateRandomSequence(): number[] {
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = await createClient();

  // Get user's squares
  const { data: userSquares, error: fetchError } = await supabase
    .from('superbowl_squares')
    .select('id, locked')
    .eq('email', user.email);

  if (fetchError) {
    console.error('Failed to fetch user squares:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch your squares' }, { status: 500 });
  }

  if (!userSquares || userSquares.length === 0) {
    return NextResponse.json({ error: 'You have no squares to lock' }, { status: 400 });
  }

  // Check if already locked
  if (userSquares.some((s) => s.locked)) {
    return NextResponse.json({ error: 'Your squares are already locked' }, { status: 400 });
  }

  // Lock all user's squares
  const { error: updateError } = await supabase
    .from('superbowl_squares')
    .update({ locked: true })
    .eq('email', user.email);

  if (updateError) {
    console.error('Failed to lock squares:', updateError);
    return NextResponse.json({ error: 'Failed to lock squares' }, { status: 500 });
  }

  // Send SMS notification
  await sendSquaresNotification(user.email, userSquares.length);

  // Check if all 100 squares are now locked
  const { count: lockedCount } = await supabase
    .from('superbowl_squares')
    .select('*', { count: 'exact', head: true })
    .eq('locked', true);

  let config = null;
  if (lockedCount === 100) {
    // Check if sequences already exist
    const { data: existingConfig } = await supabase
      .from('superbowl_config')
      .select('row_sequence, col_sequence')
      .single();

    if (!existingConfig) {
      // Generate random sequences
      const rowSequence = generateRandomSequence();
      const colSequence = generateRandomSequence();

      const { data: newConfig, error: configError } = await supabase
        .from('superbowl_config')
        .insert({
          id: 1,
          row_sequence: rowSequence,
          col_sequence: colSequence,
        })
        .select('row_sequence, col_sequence')
        .single();

      if (configError) {
        console.error('Failed to generate sequences:', configError);
      } else {
        config = newConfig;
      }
    } else {
      config = existingConfig;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Locked ${userSquares.length} square${userSquares.length !== 1 ? 's' : ''}`,
    config,
  });
}
