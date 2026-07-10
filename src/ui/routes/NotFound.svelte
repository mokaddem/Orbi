<script lang="ts">
  import { t } from '../../i18n';
  import Mascot from '../components/Mascot.svelte';

  // 404: pair the message with the mascot, matching every other empty state in the app
  // (Summary/History/Progress) so a dead end still feels on-brand rather than bare.
</script>

<section class="notfound">
  <Mascot pose="thinking" size={120} />
  <h1>{$t('notFound.title')}</h1>
  <a class="back" href="#/">{$t('notFound.back')}</a>
</section>

<style>
  .notfound {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.9rem;
    padding: 2.5rem 1rem 1rem;
  }

  h1 {
    margin: 0;
  }

  .back {
    padding: 0.6rem 1.2rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-radius: var(--radius);
    font-weight: 800;
    box-shadow: var(--shadow-chunky);
  }

  .back:hover {
    text-decoration: none;
  }
</style>
