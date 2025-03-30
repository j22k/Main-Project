# from gtts import gTTS
# import os

# text = "Hello, this is a test speech conversion."

# # Convert text to speech
# tts = gTTS(text)
# tts.save("output.mp3")  # Saves as MP3

# # Convert MP3 to WAV
# os.system("ffmpeg -i output.mp3 output.wav")

# # Convert MP3 to WEBM
# os.system("ffmpeg -i output.mp3 -c:a libopus output.webm")

# print("Conversion complete!")

import pyttsx3

engine = pyttsx3.init()

# List available voices
voices = engine.getProperty('voices')

# Select a male voice
for voice in voices:
    if "male" in voice.name.lower() or "david" in voice.name.lower():
        engine.setProperty('voice', voice.id)
        break

engine.save_to_file("Hello, this is a test speech using a male voice.", "output.wav")
engine.runAndWait()

print("Male voice WAV file saved.")
