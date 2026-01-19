import { NextResponse } from 'next/server';
import { getUser } from '../../lib/simpleAuth';
import { createClient } from '../../utils/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const [squaresResult, configResult] = await Promise.all([
    supabase.from('superbowl_squares').select('row_num, col_num, email, locked'),
    supabase.from('superbowl_config').select('row_sequence, col_sequence').single(),
  ]);

  if (squaresResult.error) {
    console.error('Failed to fetch squares:', squaresResult.error);
    return NextResponse.json({ error: 'Failed to fetch squares' }, { status: 500 });
  }

  return NextResponse.json({
    squares: squaresResult.data,
    config: configResult.data || null,
  });
}

export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { row, col } = await request.json();

  if (typeof row !== 'number' || typeof col !== 'number' ||
      row < 0 || row > 9 || col < 0 || col > 9) {
    return NextResponse.json({ error: 'Invalid row or column' }, { status: 400 });
  }

  const supabase = await createClient();

  // Check if user already has any locked squares
  const { data: userSquares } = await supabase
    .from('superbowl_squares')
    .select('locked')
    .eq('email', user.email)
    .eq('locked', true)
    .limit(1);

  if (userSquares && userSquares.length > 0) {
    return NextResponse.json({ error: 'You have already locked in your squares' }, { status: 403 });
  }

  // Check if the square is already taken
  const { data: existingSquare } = await supabase
    .from('superbowl_squares')
    .select('email, locked')
    .eq('row_num', row)
    .eq('col_num', col)
    .single();

  if (existingSquare) {
    // Square is taken
    if (existingSquare.email !== user.email) {
      return NextResponse.json({ error: 'Square is taken by another user' }, { status: 403 });
    }

    // User owns this square - delete it (toggle off)
    if (existingSquare.locked) {
      return NextResponse.json({ error: 'Cannot modify locked squares' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('superbowl_squares')
      .delete()
      .eq('row_num', row)
      .eq('col_num', col)
      .eq('email', user.email);

    if (deleteError) {
      console.error('Failed to release square:', deleteError);
      return NextResponse.json({ error: 'Failed to release square' }, { status: 500 });
    }

    return NextResponse.json({ action: 'released', row, col });
  }

  // Square is empty - claim it
  const { error: insertError } = await supabase
    .from('superbowl_squares')
    .insert({
      row_num: row,
      col_num: col,
      email: user.email,
      locked: false
    });

  if (insertError) {
    console.error('Failed to claim square:', insertError);
    return NextResponse.json({ error: 'Failed to claim square' }, { status: 500 });
  }

  return NextResponse.json({ action: 'claimed', row, col, email: user.email });
}
