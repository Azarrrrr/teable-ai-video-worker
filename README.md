# Teable AI Video Worker

Independent video production. Original/final/prepared videos stay in Teable. Cloudinary receives JPEG covers only. No user media or credentials are committed or uploaded as public artifacts.

Workflow: explicit Queued -> remote source probing and six-frame contact sheets -> Planning -> Teable AI vision generates edit plan and full HTML/CSS/GSAP composition -> GitHub worker executes AI cut list, Reap captions/highlights, FFmpeg framing, browser motion validation, HyperFrames rendering, music mixing and Teable delivery. Model output and validation evidence live in the job.

The AI runtime is called inside the Teable automation, never from GitHub with an automation token. Composition resources are local, CSP blocks network access. Three substantial moving elements must pass 25 timeline samples. The worker returns bad compositions for up to two AI repairs, then Needs Review. This checks technical motion, not subjective artistic quality.

Up to eight sources and sixteen cuts, 3 seconds to 15 minutes per input, 500 MB per download. AI sees six sampled frames per source, not a full speech transcript. Reap handles speech captions. Saved Reap projects are reused to prevent duplicate submissions. When reusing a project, its existing edit is preserved.

AI chooses uploaded music by index, or tempo/mood/key for an original synthesized instrumental bed. It is not a licensed stock-music catalogue. Music is ducked under speech. Rendered contact sheets provide a reviewable record of real output.
