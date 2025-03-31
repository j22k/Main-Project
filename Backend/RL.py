
import random
import pickle

class EmotionRLAgent:
    def __init__(self, actions, learning_rate=0.1, discount_factor=0.95, epsilon=0.2):
        """
        Initialize the RL agent for adaptive tutoring based on student emotion.

        Parameters:
            actions (list): List of possible adaptive actions (e.g., ["Repeat lesson", "Offer additional hint", "Slow down pace", ...]).
            learning_rate (float): Learning rate (alpha) for updating Q-values.
            discount_factor (float): Discount factor (gamma) for future rewards.
            epsilon (float): Exploration probability for the epsilon-greedy policy.
        """
        self.actions = actions
        self.alpha = learning_rate
        self.gamma = discount_factor
        self.epsilon = epsilon
        self.q_table = {}  # Dictionary to store Q-values keyed by (state, action) tuples.

    def get_q(self, state, action):
        """
        Retrieve the Q-value for a given state-action pair.
        Returns 0.0 if the pair is not in the Q-table.
        """
        return self.q_table.get((state, action), 0.0)

    def choose_action(self, state):
        """
        Select an action for the given state using an epsilon-greedy policy.
        
        Parameters:
            state (str): The current emotional state.
        
        Returns:
            action (str): The chosen adaptive action.
        """
        # With probability epsilon, choose a random action (exploration)
        if random.random() < self.epsilon:
            return random.choice(self.actions)
        # Otherwise, choose the action with the highest Q-value (exploitation)
        q_values = {action: self.get_q(state, action) for action in self.actions}
        max_q = max(q_values.values())
        # If multiple actions have the same maximum Q-value, pick one at random.
        best_actions = [action for action, q in q_values.items() if q == max_q]
        return random.choice(best_actions)

    def update(self, state, action, reward, next_state):
        """
        Update the Q-value for the state-action pair using the Q-learning update rule.

        Parameters:
            state (str): The current state.
            action (str): The action taken.
            reward (float): The reward received after taking the action.
            next_state (str): The state resulting after the action.
        """
        current_q = self.get_q(state, action)
        # Find the maximum Q-value for the next state.
        next_max_q = max([self.get_q(next_state, a) for a in self.actions], default=0.0)
        # Q-learning update formula:
        # Q(s,a) = Q(s,a) + alpha * (reward + gamma * max(Q(s', a')) - Q(s,a))
        new_q = current_q + self.alpha * (reward + self.gamma * next_max_q - current_q)
        self.q_table[(state, action)] = new_q

    def save(self, filepath):
        """
        Save the Q-table to a file.
        
        Parameters:
            filepath (str): Path to the file where the Q-table will be saved.
        """
        with open(filepath, 'wb') as f:
            pickle.dump(self.q_table, f)

    def load(self, filepath):
        """
        Load the Q-table from a file.
        
        Parameters:
            filepath (str): Path to the file from which to load the Q-table.
        """
        with open(filepath, 'rb') as f:
            self.q_table = pickle.load(f)

# Example usage (this block can be removed when integrating the agent into your project)
if __name__ == "__main__":
    actions = ["Repeat lesson", "Offer additional hint", "Slow down pace", "Provide encouragement", "Proceed normally"]
    agent = EmotionRLAgent(actions=actions)
    # Assume the current emotion is "Anger"
    current_state = "Anger"
    action = agent.choose_action(current_state)
    print(f"Chosen action for state '{current_state}': {action}")
    
    # Simulate receiving a reward and transitioning to a new state ("Neutral")
    reward = 1.0
    next_state = "Neutral"
    agent.update(current_state, action, reward, next_state)
    print("Updated Q-table:", agent.q_table)