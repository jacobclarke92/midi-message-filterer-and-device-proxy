# Midi message filterer / midi device proxy

Got a midi controller that's playing up and performing free jazz all over your DAW?  
Same. This is a simple tool to work around that by acting as a proxy for your midi device and filtering out messages you don't want to see.

It remembers your settings and lets you download a settings file to restore later.

I could have built this by hand but thought I'd give vibecoding a bit of a go because I'd rather get back to making music.  
Have not bundled this into an app so you'll need node/npm and pnpm installed locally to run it.

To run it, cd to root folder and: `pnpm dev`

---

The prompt:

```
I have a midi controller (Livid OhmRGB) that by all accounts works fine but seems to be spamming midi messages on CC#33 to the point where I can’t map anything in Ableton because it always reverts to the midi message being spammed.
I’m sure it’s a hardware issue but I don't particularly feel like getting out the soldering iron and I also have no idea which knob/fader/button corresponds to cc#33.
I was wondering if you would be able to make a Mac app or program that effectively acts as a ‘proxy’ where it takes in all midi messages from a device and filters out some.
I've set up a blank repo here using pnpm. I was hoping this could be a webapp because I'm fairly sure javascript spec supports midi.
Grill me on the UI settings you're not sure of and what options to include. Would be great if it stored settings on localStorage for easy reuse (saving and loading settings via json file would also be great)

Q: How would you like to handle the MIDI routing?
A: Alright, let's make it a node app then. Use fastify as the webserver and socketIO to pass messages in and out of the web ui.
Q: What tech stack would you prefer for the frontend?
A: React
Q: What should the filter configuration options look like?
A: Yes, the ability to supply one or more CC message to filter out
Q: How should we handle incoming MIDI logs?
A: Is there a performant way to keep it in a buffer? Only keep the last 250 lines but add ability to pause output so it can be inspected.

Okay just to make the tool more versatile can you update so that blocked messages can have the channel specified too (with default option being all channels)?
```
