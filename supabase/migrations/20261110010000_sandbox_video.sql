update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'video/mp4')
where id = 'audio'
  and not ('video/mp4' = any(allowed_mime_types));

create unique index audio_clips_sandbox_video_per_work
on public.audio_clips(work_id)
where audio_path like 'sandbox-video/%';
