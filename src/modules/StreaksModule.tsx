import { useStore } from '../store';
import { Panel } from '../components/Panel';
import { addDays, todayISO } from '../util';
import { COMPETITION_TOTAL, beatenAfter, competitionLeft, streakStats } from '../competition';

// the last 7 day-ISOs, oldest → today
const last7 = (today: string) => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

export function StreaksModule() {
  const goals = useStore((s) => s.goals);
  const toggleGoalCheckIn = useStore((s) => s.toggleGoalCheckIn);
  const setModule = useStore((s) => s.setModule);

  const today = todayISO();
  const week = last7(today);

  return (
    <Panel title="STREAKS" accent="streaks">
      {goals.length > 0 && (
        <p className="comp-hint dim">
          Picture <b>100,000</b> people setting the same goal. Every check-in knocks out the ones who
          quit that day — the big number is how many are still going, and <b>beat</b> is how many
          you&rsquo;ve outlasted. It counts your total check-ins, not consecutive days (that&rsquo;s
          the 🔥 streak).
        </p>
      )}
      <ul className="streak-list">
        {goals.length === 0 && (
          <li className="empty">
            no goals to track yet —{' '}
            <button className="goal-link" onClick={() => setModule('goals')}>
              create one in GOALS [7] →
            </button>
          </li>
        )}
        {goals.map((g) => {
          const done = g.checkIns.length;
          const { current, best } = streakStats(g.checkIns);
          const left = competitionLeft(done);
          const beaten = beatenAfter(done);
          const checkedToday = g.checkIns.includes(today);
          return (
            <li key={g.id} className={`streak-item${checkedToday ? ' done-today' : ''}`}>
              <button
                className="streak-check"
                onClick={() => toggleGoalCheckIn(g.id, today)}
                title={checkedToday ? 'Uncheck today' : 'Check off today'}
              >
                {checkedToday ? '[x]' : '[ ]'}
              </button>

              <div className="streak-main">
                <div className="streak-head">
                  <span className="streak-title">{g.title}</span>
                  <span className="streak-fire">🔥 {current}</span>
                  {best > current && <span className="badge">best {best}</span>}
                </div>
                <div className="streak-dots" title="last 7 days">
                  {week.map((d) => (
                    <span
                      key={d}
                      className={`streak-dot${g.checkIns.includes(d) ? ' on' : ''}${
                        d === today ? ' today' : ''
                      }`}
                      title={d}
                    >
                      {g.checkIns.includes(d) ? '✓' : '·'}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="streak-counter"
                title={`${beaten.toLocaleString()} of ${COMPETITION_TOTAL.toLocaleString()} have quit after ${done} check-in${
                  done === 1 ? '' : 's'
                } — ${left.toLocaleString()} still going.`}
              >
                <div className="streak-counter-num">{left.toLocaleString()}</div>
                <div className="streak-counter-sub">
                  left · beat {beaten.toLocaleString()} of {COMPETITION_TOTAL.toLocaleString()}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
