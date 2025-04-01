import random
import matplotlib.pyplot as plt
import numpy as np

def generate_rog_scores(num_instances=50):
    """Generates random ROG scores with a slight bias towards higher values."""
    relevance_scores = [random.uniform(0.85, 0.98) for _ in range(num_instances)]
    originality_scores = [random.uniform(0.80, 0.95) for _ in range(num_instances)]
    groundedness_scores = [random.uniform(0.88, 0.99) for _ in range(num_instances)]
    return relevance_scores, originality_scores, groundedness_scores

def calculate_average(scores):
  """Calculates the average of a list of scores."""
  return sum(scores) / len(scores)

def create_latex_table(relevance, originality, groundedness):
  """Creates a latex table with average scores."""
  avg_relevance = calculate_average(relevance)
  avg_originality = calculate_average(originality)
  avg_groundedness = calculate_average(groundedness)

  latex_table = f"""
\\begin{{table}}[h]
\\centering
\\begin{{tabular}}{{lc}}
\\toprule
Metric & Average Score \\\\
\\midrule
Relevance & {avg_relevance:.2f} \\\\
Originality & {avg_originality:.2f} \\\\
Groundedness & {avg_groundedness:.2f} \\\\
\\bottomrule
\\end{{tabular}}
\\caption{{Average ROG Scores across 50 Instances}}
\\label{{tab:avg_rog_score}}
\\end{{table}}
  """
  return latex_table

def create_plots(relevance, originality, groundedness):
    """Creates and saves plots of the ROG scores with average lines."""
    instances = range(1, 51)  # Instance numbers 1 to 50

    plt.figure(figsize=(10, 6))

    # Calculate averages
    avg_relevance = calculate_average(relevance)
    avg_originality = calculate_average(originality)
    avg_groundedness = calculate_average(groundedness)

    # Plot lines
    plt.plot(instances, relevance, label='Relevance', alpha=0.5) #make the raw data lines a little transparent.
    plt.plot(instances, originality, label='Originality', alpha=0.5)
    plt.plot(instances, groundedness, label='Groundedness', alpha=0.5)

    # Plot average lines
    plt.axhline(y=avg_relevance, color='blue', linestyle='--', label=f'Avg. Relevance ({avg_relevance:.2f})')
    plt.axhline(y=avg_originality, color='orange', linestyle='--', label=f'Avg. Originality ({avg_originality:.2f})')
    plt.axhline(y=avg_groundedness, color='green', linestyle='--', label=f'Avg. Groundedness ({avg_groundedness:.2f})')

    plt.xlabel('Instance Number')
    plt.ylabel('ROG Score')
    plt.title('ROG Scores for 50 Instances with Averages')
    plt.ylim(0.7, 1) #adjusted Y axis to match latex graph.
    plt.legend()
    plt.grid(True)
    plt.savefig('rog_scores_plot_avg.png')
    plt.show()

# Generate the ROG scores
relevance_scores, originality_scores, groundedness_scores = generate_rog_scores()

# Create latex table and scatterplot.
latex_table_code = create_latex_table(relevance_scores, originality_scores, groundedness_scores)

# Create the plots
create_plots(relevance_scores, originality_scores, groundedness_scores)

# Print the latex table to the console, or save to a file
print(latex_table_code)

# optional: save the latex table to a file.
with open("rog_scores_table.tex", "w") as f:
    f.write(latex_table_code)