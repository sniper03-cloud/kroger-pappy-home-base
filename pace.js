const start = Date.parse('2026-11-27T16:00:00-05:00');
const close = Date.parse('2026-11-27T20:00:00-05:00');
const minute = 60_000;
const checkpoints = [
  { id: 'cedar-springs', name: 'Cedar Springs', by: 5, time: '4:05 p.m.' },
  { id: 'auburndale', name: 'Auburndale', by: 55, time: '4:55 p.m.' },
  { id: 'mcmahan-plaza', name: 'McMahan Plaza', by: 120, time: '6:00 p.m.' },
  { id: 'forest-springs', name: 'Forest Springs', by: 175, time: '6:55 p.m.' },
  { id: 'holiday-manor', name: 'Holiday Manor', by: 220, time: '7:40 p.m.' },
  { id: 'st-matthews', name: 'Hubbards Lane', by: 235, time: '7:55 p.m.' },
];

function timeLeft(now) {
  const minutes = Math.ceil((close - now) / minute);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return minutes + ' min left';
  return hours + ' hr' + (remainder ? ' ' + remainder + ' min' : '') + ' left';
}

function routeAdvice(completed, now) {
  const forest = completed.get('forest-springs');
  const prospectCutoff = start + 155 * minute;
  if (forest >= start && forest <= now && now <= prospectCutoff && !completed.has('prospect')) {
    return {
      stop: 'prospect',
      message: 'Prospect may fit. Go Westport, Springhurst, Ballardsville, Prospect, Holiday Manor, then Hubbards.',
    };
  }
  if (now >= start + 215 * minute && completed.has('westport') &&
      !completed.has('holiday-manor') && !completed.has('st-matthews')) {
    return {
      stop: 'st-matthews',
      message: 'Time is tight. Check the drive to Hubbards Lane before adding Holiday Manor.',
    };
  }
  return null;
}

export function getRoutePace(completed, now, routeComplete) {
  if (now >= close) return { clock: 'Entries closed', detail: 'The drawing window ended at 8:00 p.m. Eastern.' };
  if (now < start) return { clock: 'Starts at 4:00 p.m. Eastern', detail: 'First checkpoint: finish Cedar Springs by 4:05 p.m. Friday.' };
  const clock = timeLeft(now);
  if (routeComplete) return { clock, detail: 'Home Base route complete.' };

  const checkpoint = checkpoints.find(stop => !completed.has(stop.id));
  const advice = routeAdvice(completed, now);
  if (!checkpoint) return { clock, detail: 'All timed checkpoints complete.', advice };

  const deadline = start + checkpoint.by * minute;
  const target = checkpoint.name + ' by ' + checkpoint.time;
  if (now > deadline) {
    const behind = Math.ceil((now - deadline) / minute);
    return { clock, detail: behind + ' min past target · ' + target, behind: true, advice };
  }

  const previous = checkpoints.slice(0, checkpoints.indexOf(checkpoint)).reverse()
    .find(stop => completed.get(stop.id) >= start && completed.get(stop.id) <= now);
  if (previous) {
    const delta = Math.round((completed.get(previous.id) - start) / minute - previous.by);
    const pace = delta === 0 ? 'On time' : Math.abs(delta) + ' min ' + (delta < 0 ? 'ahead' : 'behind');
    return { clock, detail: pace + ' at ' + previous.name + ' · Next: ' + target, behind: delta > 0, advice };
  }
  return { clock, detail: 'Next checkpoint: ' + target, advice };
}
